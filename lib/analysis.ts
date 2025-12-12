import crypto from 'crypto';
import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import { sanitizeAllowedDomainsInput, normalizeUrlForClick } from './allowedDomains';
import { openai, OPENAI_MODEL } from './openai';
import { prisma } from './prisma';

type MarketResearch =
  | {
      status: 'COMPLETED';
      summary: string;
      sources: string[];
      citations: string[];
      officialChecks?: string[];
    }
  | {
      status: 'SKIPPED' | 'FAILED';
      reason: string;
      sources?: string[];
      citations?: string[];
      officialChecks?: string[];
    };

export const ScoreStatusValues = {
  VERIFIED: 'VERIFIED',
  PARTIAL: 'PARTIAL',
  UNKNOWN: 'UNKNOWN',
} as const;

const factSchema = z.object({ value: z.union([z.string(), z.number()]).nullable(), citations: z.array(z.string()) });

export const extractedFactsSchema = z.object({
  reserved_mw: factSchema.extend({ value: z.number().nullable() }),
  voltage_kv: factSchema.extend({ value: z.number().nullable() }),
  energization_target: factSchema.extend({ value: z.string().nullable() }),
  firmness_type: factSchema.extend({ value: z.enum(['firm', 'non_firm', 'flex', 'unknown']) }),
  curtailment_cap: factSchema.extend({ value: z.string().nullable() }),
  grid_title_artifact: factSchema.extend({ value: z.string().nullable() }),
  permits_status: factSchema.extend({ value: z.string().nullable() }),
  customer_traction: factSchema.extend({ value: z.string().nullable() }),
});

export const checklistSchema = z.array(
  z.object({
    priority: z.string(),
    question: z.string(),
    why: z.string().optional(),
    requested_artifact: z.string().nullable().optional(),
    contextual: z.boolean().optional(),
  })
);

export const evidenceSchema = z.object({
  extracted_facts: extractedFactsSchema,
  checks: checklistSchema,
});

export const scorecardSchema = z.array(
  z.object({
    criterion: z.string(),
    status: z.nativeEnum(ScoreStatusValues),
    rationale: z.string(),
    citations: z.array(z.string()).default([]),
  })
);

type ExtractedFacts = z.infer<typeof extractedFactsSchema>;
type ChecklistItem = z.infer<typeof checklistSchema>[number];

export type EvidenceSnippet = {
  snippetId: string;
  text: string;
  fileId?: string;
  openaiFileId?: string;
  openaiDocumentId?: string;
  openaiVectorStoreId?: string;
  fileName?: string;
  score?: number;
  metadata?: Record<string, any>;
};

const RETRIEVAL_QUERIES = [
  'grid connection agreement or grid contract details',
  'reserved MW or capacity reservation amount',
  'voltage kV level of connection',
  'energization date or COD milestone',
  'firmness or non firm flex connection terms',
  'curtailment cap or limits',
  'grid title deed or connection title artifact',
  'permits or consents status',
  'fiber or connectivity backhaul provider',
  'customer traction LOI or contract',
];

const SNIPPET_LIMIT = 25;
const SNIPPET_TEXT_LIMIT = 1200;

const DEFAULT_FACTS: ExtractedFacts = {
  reserved_mw: { value: null, citations: [] },
  voltage_kv: { value: null, citations: [] },
  energization_target: { value: null, citations: [] },
  firmness_type: { value: 'unknown', citations: [] },
  curtailment_cap: { value: null, citations: [] },
  grid_title_artifact: { value: null, citations: [] },
  permits_status: { value: null, citations: [] },
  customer_traction: { value: null, citations: [] },
};

export function createSnippetId(fileId: string | undefined, text: string) {
  return crypto.createHash('sha256').update(`${fileId || 'unknown'}:${text}`).digest('hex');
}

async function retrieveEvidenceSnippets(vectorStoreId?: string): Promise<EvidenceSnippet[]> {
  const openaiClient = openai as any;
  if (!vectorStoreId || !openaiClient?.vectorStores?.search) return [];

  const collected: EvidenceSnippet[] = [];
  const seen = new Set<string>();

  for (const query of RETRIEVAL_QUERIES) {
    const search = await openaiClient.vectorStores
      .search(vectorStoreId, { query, max_num_results: 5 })
      .catch(() => ({ data: [] }));

    const results = (search?.data as any[]) || [];
    for (const result of results) {
      const chunks = (result.content || []).filter((c: any) => typeof c.text === 'string');
      for (const chunk of chunks) {
        const text = String(chunk.text || '').slice(0, SNIPPET_TEXT_LIMIT);
        if (!text) continue;
        const snippetId = createSnippetId(result.file_id, `${query}:${text}`);
        if (seen.has(snippetId)) continue;
        seen.add(snippetId);
        collected.push({
          snippetId,
          text,
          fileId: result.file_id,
          openaiFileId: result.file_id,
          openaiVectorStoreId: vectorStoreId,
          fileName: result.filename,
          score: typeof result.score === 'number' ? result.score : undefined,
          metadata: result.attributes,
        });
      }
    }
  }

  return collected
    .sort((a, b) => (b.score || 0) - (a.score || 0) || a.snippetId.localeCompare(b.snippetId))
    .slice(0, SNIPPET_LIMIT);
}

function buildPromptFromSnippets(snippets: EvidenceSnippet[]) {
  const lines = snippets.map((s) => `Snippet ${s.snippetId}: ${s.text}`);
  return [
    'You are an evidence-first analyst. Only use the provided snippets as sources.',
    'Cite snippet_ids for every fact. If no evidence exists, return null and add a targeted question.',
    'Snippets:',
    lines.join('\n'),
  ].join('\n\n');
}

async function extractFacts(snippets: EvidenceSnippet[]) {
  if (!openai?.responses?.create || snippets.length === 0) {
    return { extracted_facts: DEFAULT_FACTS, checks: [{ priority: 'High', question: 'Provide evidence for grid connection and capacity.', why: 'No snippets retrieved', requested_artifact: 'Grid contract' }] };
  }

  const prompt = buildPromptFromSnippets(snippets);
  const schema = z.object({
    extracted_facts: extractedFactsSchema,
    checks: checklistSchema,
  });

  const format = zodTextFormat(schema, 'evidence_payload');
  const response = await (openai as any).responses
    .create({
      model: OPENAI_MODEL,
      input: prompt,
      temperature: 0,
      response_format: format,
    })
    .catch(() => null);

  if (!response) {
    return { extracted_facts: DEFAULT_FACTS, checks: [{ priority: 'High', question: 'Share substantiation for grid connection and permits.', why: 'OpenAI extraction failed', requested_artifact: 'Grid + permits' }] };
  }

  let parsed: z.infer<typeof schema>;
  if (response.output_parsed) {
    parsed = response.output_parsed as z.infer<typeof schema>;
  } else {
    const text = response.output_text || extractTextFromResponse(response);
    parsed = schema.parse(JSON.parse(text));
  }
  const snippetIds = new Set(snippets.map((s) => s.snippetId));
  const normalizedFacts = { ...DEFAULT_FACTS } as ExtractedFacts;
  const missingCitations: ChecklistItem[] = [];

  (Object.keys(parsed.extracted_facts) as (keyof ExtractedFacts)[]).forEach((key) => {
    const fact = parsed.extracted_facts[key];
    const citations = (fact.citations || []).filter((c) => snippetIds.has(c));
    if (fact.value !== null && citations.length === 0) {
      normalizedFacts[key] = { value: null, citations: [] } as any;
      missingCitations.push({
        priority: 'High',
        question: `Provide evidence for ${key.replace(/_/g, ' ')} with a citation.`,
        why: 'Model returned a value without a valid snippet citation.',
        requested_artifact: 'Evidence backing the fact',
        contextual: true,
      });
    } else {
      normalizedFacts[key] = {
        value: fact.value,
        citations,
      } as any;
    }
  });

  return { extracted_facts: normalizedFacts, checks: parsed.checks.concat(missingCitations) };
}

function extractTextFromResponse(response: any) {
  if (!response) return '';
  if (typeof response.output_text === 'string') return response.output_text;
  const outputContent = (response.output || []).flatMap((o: any) => o?.content || []);
  const textChunk = outputContent.find((c: any) => typeof c?.text === 'string' || typeof c?.output_text === 'string');
  if (textChunk?.text) return textChunk.text;
  if (textChunk?.output_text) return textChunk.output_text;
  return '';
}

function collectSourcesFromValue(value: any, bucket: Set<string>) {
  if (!value) return;
  if (typeof value === 'string') {
    bucket.add(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v) => collectSourcesFromValue(v, bucket));
    return;
  }
  if (typeof value === 'object') {
    collectSourcesFromValue((value as any).url || (value as any).link || (value as any).source || (value as any).href, bucket);
  }
}

function extractSourcesFromResponse(response: any): string[] {
  const sources = new Set<string>();
  collectSourcesFromValue(response?.web_search_call?.action?.sources, sources);
  const outputs = Array.isArray(response?.output) ? response.output : [];
  outputs.forEach((item: any) => {
    collectSourcesFromValue(item?.web_search_call?.action?.sources, sources);
    const content = Array.isArray(item?.content) ? item.content : [];
    content.forEach((c: any) => collectSourcesFromValue(c?.web_search_call?.action?.sources, sources));
  });
  return Array.from(sources.values()).filter(Boolean);
}

function extractCitationsFromSummary(summary: string, sources: string[]) {
  const matches = Array.from(summary.matchAll(/\[(\d+)\]/g));
  const indices = Array.from(new Set(matches.map((m) => Number(m[1]))));
  return indices.map((idx) => sources[idx - 1]).filter(Boolean);
}

async function runMarketResearch({
  country,
  allowedDomains,
}: {
  country: string;
  allowedDomains: string[];
}): Promise<MarketResearch | null> {
  const openaiClient = openai as any;
  if (!openaiClient?.responses?.create) return null;
  if (!allowedDomains || allowedDomains.length === 0) return null;

  const prompt = [
    `You are performing official-only market research for ${country}.`,
    'Only use government, regulator, system operator, or other official domains provided. Do NOT reference or infer details about any specific deal.',
    'Produce a concise, citation-rich summary that covers: (1) grid connection process for large loads, (2) firmness/flex/non-firm mechanisms, (3) queue/milestone/expiry rules, (4) official artefacts that prove capacity reservation.',
    'Add a short list of additional checks/questions for investors referencing official policy. Keep the entire output under 180 words.',
    'Cite sources inline using [1], [2] etc. Ensure citations map to the sources you consulted.',
  ].join('\n');

  const response = await openaiClient.responses
    .create({
      model: OPENAI_MODEL,
      input: prompt,
      tools: [{ type: 'web_search', filters: { allowed_domains: allowedDomains } }],
      include: ['web_search_call.action.sources'],
    })
    .catch(() => null);

  if (!response) return null;

  const summary = extractTextFromResponse(response).trim();
  if (!summary) return null;
  const sources = extractSourcesFromResponse(response).map(normalizeUrlForClick).filter(Boolean);
  const citations = extractCitationsFromSummary(summary, sources).map(normalizeUrlForClick).filter(Boolean);

  return { status: 'COMPLETED', summary, sources, citations };
}

export async function runDeterministicAnalysis({
  dealId,
  userId,
  organizationId,
  includeMarketResearch = false,
}: {
  dealId: string;
  userId: string;
  organizationId: string;
  includeMarketResearch?: boolean;
}) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      fund: { include: { organization: { include: { countryPacks: true } } } },
      documents: true,
    },
  });
  if (!deal) throw new Error('Deal not found');
  if (deal.fund.organizationId !== organizationId) throw new Error('Forbidden');

  const snippets = await retrieveEvidenceSnippets(deal.openaiVectorStoreId || undefined);
  const evidence = await extractFacts(snippets);
  let checklist = buildChecklist(evidence.extracted_facts, evidence.checks);
  const scorecard = buildScorecard(evidence.extracted_facts);

  const countryPack = deal.fund.organization.countryPacks.find(
    (p) => p.countryCode.toLowerCase() === deal.country.toLowerCase()
  );
  const allowedDomains = sanitizeAllowedDomainsInput(countryPack?.allowedDomains || []).sanitized;
  let marketResearch: MarketResearch | null = null;

  if (includeMarketResearch) {
    if (!allowedDomains || allowedDomains.length === 0) {
      marketResearch = { status: 'SKIPPED', reason: 'No allowed domains configured' };
      checklist = checklist.concat({
        priority: 'Medium',
        question: 'Configure official allowed domains in the Country Pack to enable official market research.',
        why: 'No allowed domains configured for this country',
        requested_artifact: null,
        contextual: true,
      });
    } else {
      marketResearch =
        (await runMarketResearch({ country: deal.country, allowedDomains }).catch(() => null)) ??
        ({ status: 'FAILED', reason: 'Market research unavailable' } as MarketResearch);
    }
  }

  const confidence = computeEnergizationConfidence(evidence.extracted_facts, checklist);

  const summary = `Evidence-led view: ${scorecard.filter((s) => s.status === ScoreStatusValues.VERIFIED).length} verified, ${scorecard.filter((s) => s.status === ScoreStatusValues.UNKNOWN).length} unknown. Energization confidence: ${confidence}%`;

  const run = await prisma.analysisRun.create({
    data: {
      dealId: deal.id,
      executedById: userId,
      evidence: evidenceSchema.parse(evidence),
      scorecard: scorecardSchema.parse(scorecard),
      summary,
      checklist: checklistSchema.parse(checklist),
      marketResearch: marketResearch || undefined,
      marketResearchIncluded: Boolean(includeMarketResearch),
      status: 'SUCCESS',
      errorMessage: null,
      modelUsed: OPENAI_MODEL,
    },
  });

  if (snippets.length > 0) {
    await prisma.analysisEvidenceSnippet.createMany({
      data: snippets.map((s) => ({
        analysisRunId: run.id,
        snippetId: s.snippetId,
        text: s.text,
        fileId: s.fileId,
        fileName: s.fileName,
        openaiFileId: s.openaiFileId,
        openaiDocumentId: s.openaiDocumentId,
        openaiVectorStoreId: s.openaiVectorStoreId,
        score: s.score,
        metadata: s.metadata,
      })),
      skipDuplicates: true,
    });
  }

  await prisma.auditLog.create({
    data: {
      action: 'ANALYSIS_RUN',
      metadata: { dealId: deal.id, runId: run.id },
      userId,
      organizationId: deal.fund.organizationId,
    },
  });

  return prisma.analysisRun.findUnique({ where: { id: run.id }, include: { evidenceSnippets: true } });
}

function buildChecklist(facts: ExtractedFacts, aiChecks: ChecklistItem[]) {
  const checklist: ChecklistItem[] = [...(aiChecks || [])];
  if (!facts.reserved_mw.value) checklist.push({ priority: 'High', question: 'Provide signed grid capacity reservation (MW and title).', why: 'No evidence of reserved MW', requested_artifact: 'Grid contract' });
  if (!facts.energization_target.value) checklist.push({ priority: 'Medium', question: 'Share energization milestone with dates.', why: 'Missing energization target', requested_artifact: 'Project timeline' });
  if (!facts.permits_status.value) checklist.push({ priority: 'High', question: 'Provide permits/consents documentation.', why: 'Permits not evidenced', requested_artifact: 'Permits' });
  if (!facts.customer_traction.value) checklist.push({ priority: 'High', question: 'Evidence customer traction (LOIs/contracts).', why: 'Customer traction missing', requested_artifact: 'LOIs or contracts' });
  return checklist;
}

function buildScorecard(facts: ExtractedFacts) {
  return [
    {
      criterion: 'Power reservation',
      status: facts.reserved_mw.value ? ScoreStatusValues.VERIFIED : ScoreStatusValues.UNKNOWN,
      rationale: facts.reserved_mw.value ? `Reserved MW: ${facts.reserved_mw.value}` : 'No proof of reserved MW.',
      citations: facts.reserved_mw.citations,
    },
    {
      criterion: 'Firmness / flex terms',
      status:
        facts.firmness_type.value === 'unknown'
          ? ScoreStatusValues.UNKNOWN
          : ['non_firm', 'flex'].includes(facts.firmness_type.value)
            ? ScoreStatusValues.PARTIAL
            : ScoreStatusValues.VERIFIED,
      rationale: facts.firmness_type.value === 'unknown' ? 'Missing firmness terms.' : `Firmness: ${facts.firmness_type.value}`,
      citations: facts.firmness_type.citations,
    },
    {
      criterion: 'Permitting & land',
      status: facts.permits_status.value ? ScoreStatusValues.VERIFIED : ScoreStatusValues.UNKNOWN,
      rationale: facts.permits_status.value || 'Permits not evidenced.',
      citations: facts.permits_status.citations,
    },
    {
      criterion: 'Connectivity',
      status: facts.grid_title_artifact.value || facts.customer_traction.value ? ScoreStatusValues.VERIFIED : ScoreStatusValues.UNKNOWN,
      rationale: facts.grid_title_artifact.value || facts.customer_traction.value || 'No connectivity evidence.',
      citations: (facts.grid_title_artifact.citations || []).concat(facts.customer_traction.citations || []),
    },
    {
      criterion: 'Commercial traction',
      status: facts.customer_traction.value ? ScoreStatusValues.VERIFIED : ScoreStatusValues.UNKNOWN,
      rationale: facts.customer_traction.value || 'No evidence of customers or LOIs.',
      citations: facts.customer_traction.citations,
    },
  ];
}

export function computeEnergizationConfidence(facts: ExtractedFacts, checklist: ChecklistItem[]) {
  const outstandingChecks = checklist.filter((item) => !item.contextual).length;
  let score = 35;
  if (facts.reserved_mw.value) score += 20;
  if (facts.firmness_type.value === 'firm') score += 15;
  if (['non_firm', 'flex'].includes(facts.firmness_type.value)) score += 5;
  if (facts.permits_status.value) score += 10;
  if (facts.energization_target.value) score += 10;
  if (facts.customer_traction.value) score += 10;
  score -= outstandingChecks * 5;
  return Math.max(10, Math.min(95, score));
}
