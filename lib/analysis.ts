import 'server-only';
import crypto from 'crypto';
import { DealDocument, Prisma } from '@prisma/client';
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
    status: z.enum(Object.values(ScoreStatusValues) as [string, ...string[]]),
    rationale: z.string(),
    citations: z.array(z.string()).default([]),
  })
);

type ExtractedFacts = z.infer<typeof extractedFactsSchema>;
type ChecklistItem = z.infer<typeof checklistSchema>[number];

type EvidenceSnippet = {
  snippetId: string;
  text: string;
  fileId?: string;
  fileName?: string;
  score?: number;
  metadata?: Record<string, unknown> | null;
  openaiFileId?: string;
  dealDocumentId?: string;
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

function buildDefaultFacts(): ExtractedFacts {
  return {
    reserved_mw: { value: null, citations: [] },
    voltage_kv: { value: null, citations: [] },
    energization_target: { value: null, citations: [] },
    firmness_type: { value: 'unknown', citations: [] },
    curtailment_cap: { value: null, citations: [] },
    grid_title_artifact: { value: null, citations: [] },
    permits_status: { value: null, citations: [] },
    customer_traction: { value: null, citations: [] },
  };
}

export const DEFAULT_EVIDENCE = { extracted_facts: buildDefaultFacts(), checks: [] };

const FIELD_NAMES: Record<keyof ExtractedFacts, string> = {
  reserved_mw: 'reserved MW',
  voltage_kv: 'voltage (kV)',
  energization_target: 'energization target',
  firmness_type: 'firmness type',
  curtailment_cap: 'curtailment cap',
  grid_title_artifact: 'grid title artifact',
  permits_status: 'permits status',
  customer_traction: 'customer traction',
};

export function createSnippetId(fileId: string | undefined, text: string) {
  return crypto.createHash('sha256').update(`${fileId || 'unknown'}:${text}`).digest('hex');
}

async function retrieveEvidenceSnippets(vectorStoreId: string | undefined, documents: DealDocument[]): Promise<EvidenceSnippet[]> {
  if (!vectorStoreId) return [];
  if (!openai?.vectorStores?.search) {
    throw new Error('OpenAI vector search unavailable');
  }

  const collected: EvidenceSnippet[] = [];
  const seen = new Set<string>();

  for (const query of RETRIEVAL_QUERIES) {
    const search = await openai.vectorStores
      .search(vectorStoreId, {
        query,
        max_num_results: 5,
      })
      .catch((err: Error) => {
        throw new Error(`Vector search failed: ${err.message}`);
      });

    const results = (search as any).data || [];
    for (const result of results) {
      const text: string = result.text || result.content?.[0]?.text || '';
      if (!text) continue;
      const snippetId = createSnippetId(result.file_id || result.document_id, text);
      if (seen.has(snippetId)) continue;
      seen.add(snippetId);
      const linkedDocument = documents.find((d) => d.openaiFileId === result.file_id);
      collected.push({
        snippetId,
        text,
        fileId: result.file_id || result.document_id,
        openaiFileId: result.file_id,
        dealDocumentId: linkedDocument?.id,
        fileName: linkedDocument?.name || result.file_name || result.metadata?.file_name,
        score: typeof result.score === 'number' ? result.score : undefined,
        metadata: result.metadata || null,
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
  if (snippets.length === 0) {
    return {
      extracted_facts: buildDefaultFacts(),
      checks: [
        {
          priority: 'High',
          question: 'Provide evidence for grid connection and capacity.',
          why: 'No snippets retrieved',
          requested_artifact: 'Grid contract',
        },
      ],
    };
  }

  if (!openai?.responses?.parse) {
    throw new Error('OpenAI Structured Outputs unavailable');
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
      temperature: 0,
    })
    .catch((err: Error) => {
      throw new Error(`OpenAI extraction failed: ${err.message}`);
    });

  const parsed = schema.parse(response as any);
  const snippetIds = new Set(snippets.map((s) => s.snippetId));
  const normalizedFacts = buildDefaultFacts();
  (Object.keys(parsed.extracted_facts) as (keyof ExtractedFacts)[]).forEach((key) => {
    const fact = parsed.extracted_facts[key];
    normalizedFacts[key] = {
      value: fact.value,
      citations: (fact.citations || []).filter((c) => snippetIds.has(c)),
    } as any;
  });

  return { extracted_facts: normalizedFacts, checks: parsed.checks };
}

function enforceCitationIntegrity(facts: ExtractedFacts, snippetIds: Set<string>) {
  const adjustedFacts = { ...facts } as ExtractedFacts;
  const checklist: ChecklistItem[] = [];

  (Object.keys(facts) as (keyof ExtractedFacts)[]).forEach((key) => {
    const fact = facts[key];
    const normalizedCitations = (fact.citations || []).filter((c) => snippetIds.has(c));
    const needsEvidence = fact.value !== null && fact.value !== 'unknown';

    if (needsEvidence && normalizedCitations.length === 0) {
      adjustedFacts[key] = { value: key === 'firmness_type' ? 'unknown' : null, citations: [] } as any;
      checklist.push({
        priority: 'High',
        question: `Provide evidence for ${FIELD_NAMES[key]} (missing citation integrity).`,
        why: 'Citation missing or does not match stored snippet.',
        requested_artifact: 'Evidence snippet',
      });
    } else {
      adjustedFacts[key] = { value: fact.value, citations: normalizedCitations } as any;
    }
  });

  return { facts: adjustedFacts, checklist };
}

function buildChecklist(facts: ExtractedFacts, aiChecks: ChecklistItem[], integrityChecks: ChecklistItem[]) {
  const checklist: ChecklistItem[] = [...(aiChecks || []), ...(integrityChecks || [])];
  if (!facts.reserved_mw.value)
    checklist.push({ priority: 'High', question: 'Provide signed grid capacity reservation (MW and title).', why: 'No evidence of reserved MW', requested_artifact: 'Grid contract' });
  if (!facts.energization_target.value)
    checklist.push({ priority: 'Medium', question: 'Share energization milestone with dates.', why: 'Missing energization target', requested_artifact: 'Project timeline' });
  if (!facts.permits_status.value)
    checklist.push({ priority: 'High', question: 'Provide permits/consents documentation.', why: 'Permits not evidenced', requested_artifact: 'Permits' });
  if (!facts.customer_traction.value)
    checklist.push({ priority: 'High', question: 'Evidence customer traction (LOIs/contracts).', why: 'Customer traction missing', requested_artifact: 'LOIs or contracts' });
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

function sanitizeErrorMessage(err: unknown) {
  if (!err) return 'Unknown error';
  if (err instanceof Error) return err.message;
  return typeof err === 'string' ? err : 'Unexpected error';
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

  try {
    const snippets = await retrieveEvidenceSnippets(deal.openaiVectorStoreId || undefined, deal.documents);
    const evidence = await extractFacts(snippets);
    const snippetIds = new Set(snippets.map((s) => s.snippetId));
    const { facts: factsWithIntegrity, checklist: integrityChecks } = enforceCitationIntegrity(evidence.extracted_facts, snippetIds);
    const checklist = buildChecklist(factsWithIntegrity, evidence.checks, integrityChecks);
    const scorecard = buildScorecard(factsWithIntegrity);
    const confidence = computeEnergizationConfidence(factsWithIntegrity, checklist.length);
    const summary = `Evidence-led view: ${scorecard.filter((s) => s.status === ScoreStatusValues.VERIFIED).length} verified, ${scorecard.filter((s) => s.status === ScoreStatusValues.UNKNOWN).length} unknown. Energization confidence: ${confidence}%`;

    const run = await prisma.analysisRun.create({
      data: {
        dealId: deal.id,
        executedById: userId,
        status: 'SUCCESS',
        errorMessage: null,
        modelUsed: OPENAI_MODEL,
        evidence: evidenceSchema.parse({ extracted_facts: factsWithIntegrity, checks: [...(evidence.checks || []), ...integrityChecks] }),
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
          metadata: (s.metadata as Prisma.InputJsonValue) ?? undefined,
          openaiFileId: s.openaiFileId,
          dealDocumentId: s.dealDocumentId,
        })),
        skipDuplicates: true,
      });

      const citedIds = Array.from(
        new Set(
          Object.values(factsWithIntegrity)
            .map((f) => f.citations)
            .flat()
        )
      );
      if (citedIds.length > 0) {
        const stored = await prisma.analysisEvidenceSnippet.findMany({
          where: { analysisRunId: run.id, snippetId: { in: citedIds } },
          select: { snippetId: true },
        });
        const storedIds = new Set(stored.map((s) => s.snippetId));
        const missingIds = citedIds.filter((id) => !storedIds.has(id));
        if (missingIds.length > 0) {
          const { facts, checklist: missingChecklist } = enforceCitationIntegrity(factsWithIntegrity, storedIds);
          const rebuiltChecklist = buildChecklist(facts, evidence.checks, [...integrityChecks, ...missingChecklist]);
          const rebuiltScorecard = buildScorecard(facts);
          const rebuiltConfidence = computeEnergizationConfidence(facts, rebuiltChecklist.length);
          const rebuiltSummary = `Evidence-led view: ${rebuiltScorecard.filter((s) => s.status === ScoreStatusValues.VERIFIED).length} verified, ${rebuiltScorecard.filter((s) => s.status === ScoreStatusValues.UNKNOWN).length} unknown. Energization confidence: ${rebuiltConfidence}%`;
          await prisma.analysisRun.update({
            where: { id: run.id },
            data: {
              evidence: evidenceSchema.parse({ extracted_facts: facts, checks: [...(evidence.checks || []), ...integrityChecks, ...missingChecklist] }),
              checklist: checklistSchema.parse(rebuiltChecklist),
              scorecard: scorecardSchema.parse(rebuiltScorecard),
              summary: rebuiltSummary,
            },
          });
        }
      }
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
  } catch (err) {
    const errorMessage = sanitizeErrorMessage(err);
    const failed = await prisma.analysisRun.create({
      data: {
        dealId: deal.id,
        executedById: userId,
        status: 'FAILED',
        errorMessage,
        modelUsed: OPENAI_MODEL,
        evidence: { extracted_facts: buildDefaultFacts(), checks: [] },
        scorecard: [],
        summary: `Analysis failed: ${errorMessage}`,
        checklist: [
          {
            priority: 'High',
            question: 'Provide evidence for grid connection and permits.',
            why: errorMessage,
            requested_artifact: 'Grid + permits evidence',
          },
        ],
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'ANALYSIS_RUN_FAILED',
        metadata: { dealId: deal.id, runId: failed.id, error: errorMessage },
        userId,
        organizationId: deal.fund.organizationId,
      },
    });

    return prisma.analysisRun.findUnique({ where: { id: failed.id }, include: { evidenceSnippets: true } });
  }
}
