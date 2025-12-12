import crypto from 'crypto';
import { z } from 'zod';
import { openai, OPENAI_MODEL } from './openai';
import { prisma } from './prisma';

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
  fileName?: string;
  score?: number;
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
  if (!vectorStoreId || !openai?.beta?.vectorStores?.search) return [];

  const collected: EvidenceSnippet[] = [];
  const seen = new Set<string>();

  for (const query of RETRIEVAL_QUERIES) {
    const search = await openai.beta.vectorStores.search({
      vector_store_id: vectorStoreId,
      query,
      limit: 5,
    }).catch(() => ({ data: [] }));

    const results = (search as any).data || [];
    for (const result of results) {
      const text: string = result.text || result.content?.[0]?.text || '';
      if (!text) continue;
      const snippetId = createSnippetId(result.file_id || result.document_id, text);
      if (seen.has(snippetId)) continue;
      seen.add(snippetId);
      collected.push({
        snippetId,
        text,
        fileId: result.file_id || result.document_id,
        fileName: result.file_name || result.metadata?.file_name,
        score: typeof result.score === 'number' ? result.score : undefined,
      });
    }
  }

  return collected;
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
  if (!openai?.responses?.parse || snippets.length === 0) {
    return { extracted_facts: DEFAULT_FACTS, checks: [{ priority: 'High', question: 'Provide evidence for grid connection and capacity.', why: 'No snippets retrieved', requested_artifact: 'Grid contract' }] };
  }

  const prompt = buildPromptFromSnippets(snippets);
  const schema = z.object({
    extracted_facts: extractedFactsSchema,
    checks: checklistSchema,
  });

  const response = await openai.responses
    .parse({
      model: OPENAI_MODEL,
      input: prompt,
      schema,
    })
    .catch(() => null);

  if (!response) {
    return { extracted_facts: DEFAULT_FACTS, checks: [{ priority: 'High', question: 'Share substantiation for grid connection and permits.', why: 'OpenAI extraction failed', requested_artifact: 'Grid + permits' }] };
  }

  const parsed = schema.parse(response as any);
  const snippetIds = new Set(snippets.map((s) => s.snippetId));
  const normalizedFacts = { ...DEFAULT_FACTS } as ExtractedFacts;
  (Object.keys(parsed.extracted_facts) as (keyof ExtractedFacts)[]).forEach((key) => {
    const fact = parsed.extracted_facts[key];
    normalizedFacts[key] = {
      value: fact.value,
      citations: (fact.citations || []).filter((c) => snippetIds.has(c)),
    } as any;
  });

  return { extracted_facts: normalizedFacts, checks: parsed.checks };
}

export async function runDeterministicAnalysis({
  dealId,
  userId,
  organizationId,
}: {
  dealId: string;
  userId: string;
  organizationId: string;
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
  const checklist = buildChecklist(evidence.extracted_facts, evidence.checks);
  const scorecard = buildScorecard(evidence.extracted_facts);
  const confidence = computeEnergizationConfidence(evidence.extracted_facts, checklist.length);
  const summary = `Evidence-led view: ${scorecard.filter((s) => s.status === ScoreStatusValues.VERIFIED).length} verified, ${scorecard.filter((s) => s.status === ScoreStatusValues.UNKNOWN).length} unknown. Energization confidence: ${confidence}%`;

  const run = await prisma.analysisRun.create({
    data: {
      dealId: deal.id,
      executedById: userId,
      evidence: evidenceSchema.parse(evidence),
      scorecard: scorecardSchema.parse(scorecard),
      summary,
      checklist: checklistSchema.parse(checklist),
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
        score: s.score,
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

export function computeEnergizationConfidence(facts: ExtractedFacts, outstandingChecks: number) {
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
