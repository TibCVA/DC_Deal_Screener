/**
 * Analysis Pipeline v1 - Produces DD Contract v1 output
 *
 * Evidence-first analysis pipeline that:
 * 1. Retrieves evidence snippets from vector store
 * 2. Extracts facts with citation integrity
 * 3. Detects contradictions
 * 4. Runs scoring pipeline
 * 5. Produces full DD Contract v1 output
 */

import crypto from 'crypto';
import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import { openai, OPENAI_MODEL, getOpenAIReasoning, getModelInfo } from './openai';
import { prisma } from './prisma';
import {
  type DDContractV1,
  type EvidenceSnippet,
  type FactValue,
  type Contradiction,
  type ArtifactRegisterEntry,
  type MarketContext,
  type FundPolicySnapshot,
  CONTRACT_VERSION,
  MARKET_CONTEXT_DISCLAIMER,
  createDefaultFundPolicy,
  createEmptyFactValue,
  DDContractV1Schema,
} from './dd-contract-v1';
import {
  FACT_CATALOG_V1,
  RETRIEVAL_QUERY_GROUPS,
  getFactByCode,
  type FactDefinition,
} from './fact-catalog-v1';
import { runScoringPipeline } from './scoring-engine-v1';
import { sanitizeAllowedDomainsInput, normalizeUrlForClick } from './allowedDomains';

// ════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════════════

const SNIPPET_LIMIT = 40;
const SNIPPET_TEXT_LIMIT = 1500;

// ════════════════════════════════════════════════════════════════════════════
// EVIDENCE RETRIEVAL
// ════════════════════════════════════════════════════════════════════════════

function createSnippetId(fileId: string | undefined, text: string): string {
  return crypto.createHash('sha256').update(`${fileId || 'unknown'}:${text}`).digest('hex');
}

async function retrieveEvidenceSnippetsV1(
  vectorStoreId: string | undefined
): Promise<EvidenceSnippet[]> {
  const openaiClient = openai as any;
  if (!vectorStoreId || !openaiClient?.vectorStores?.search) return [];

  const collected: EvidenceSnippet[] = [];
  const seen = new Set<string>();

  // Query each module group
  for (const [moduleKey, queries] of Object.entries(RETRIEVAL_QUERY_GROUPS)) {
    for (const query of queries) {
      try {
        const search = await openaiClient.vectorStores.search({
          vector_store_id: vectorStoreId,
          query,
          max_num_results: 5,
        });

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
              snippet_id: snippetId,
              text,
              source: {
                deal_document_id: null,
                file_name: result.filename || null,
              },
              retrieval: {
                query,
                score: typeof result.score === 'number' ? result.score : null,
              },
              openai: {
                vector_store_id: vectorStoreId,
                file_id: result.file_id || null,
              },
              metadata: result.attributes || null,
            });
          }
        }
      } catch {
        // Continue with other queries
      }
    }
  }

  return collected
    .sort((a, b) => (b.retrieval.score ?? 0) - (a.retrieval.score ?? 0) || a.snippet_id.localeCompare(b.snippet_id))
    .slice(0, SNIPPET_LIMIT);
}

// ════════════════════════════════════════════════════════════════════════════
// FACT EXTRACTION
// ════════════════════════════════════════════════════════════════════════════

function buildFactExtractionSchema() {
  // Build schema dynamically from fact catalog
  const factFields: Record<string, z.ZodType<any>> = {};

  for (const fact of FACT_CATALOG_V1) {
    let valueType: z.ZodType<any>;
    switch (fact.type) {
      case 'number':
        valueType = z.number().nullable();
        break;
      case 'boolean':
        valueType = z.boolean().nullable();
        break;
      default:
        valueType = z.string().nullable();
    }

    factFields[fact.code] = z.object({
      value: valueType,
      citations: z.array(z.string()),
      notes: z.string().nullable().optional(),
    });
  }

  return z.object({
    facts: z.object(factFields),
    contradictions: z.array(
      z.object({
        fact_code: z.string(),
        description: z.string(),
        conflicting_values: z.array(
          z.object({
            value: z.union([z.string(), z.number(), z.boolean()]),
            citations: z.array(z.string()),
          })
        ),
      })
    ),
    artifact_mentions: z.array(
      z.object({
        artifact_type: z.string(),
        issuer: z.string().nullable(),
        date: z.string().nullable(),
        key_info: z.string().nullable(),
        citations: z.array(z.string()),
      })
    ),
  });
}

function buildExtractionPrompt(snippets: EvidenceSnippet[]): string {
  const snippetText = snippets
    .map((s) => `[${s.snippet_id}] (${s.source.file_name || 'unknown'}): ${s.text}`)
    .join('\n\n');

  const factList = FACT_CATALOG_V1.map(
    (f) => `- ${f.code} (${f.type}${f.unit ? `, ${f.unit}` : ''}): ${f.label}`
  ).join('\n');

  return `You are an evidence-first due diligence analyst. Extract facts ONLY from the provided snippets.

## Rules:
1. ONLY use information directly stated in the snippets
2. ALWAYS cite the snippet_id for every fact value
3. If a fact is not evidenced, set value to null
4. If you find conflicting values for the same fact, report them in contradictions
5. Note any artifact mentions (contracts, permits, agreements, etc.)

## Facts to extract:
${factList}

## Snippets:
${snippetText}

Extract all facts with citations. Be precise and cite specific snippets.`;
}

async function extractFactsV1(
  snippets: EvidenceSnippet[]
): Promise<{
  facts: Record<string, FactValue>;
  contradictions: Contradiction[];
  artifactRegister: ArtifactRegisterEntry[];
}> {
  // Initialize empty facts
  const facts: Record<string, FactValue> = {};
  for (const factDef of FACT_CATALOG_V1) {
    facts[factDef.code] = createEmptyFactValue();
  }

  if (snippets.length === 0 || !openai?.responses?.parse) {
    return { facts, contradictions: [], artifactRegister: [] };
  }

  const schema = buildFactExtractionSchema();
  const prompt = buildExtractionPrompt(snippets);
  const snippetIds = new Set(snippets.map((s) => s.snippet_id));

  try {
    const response = await (openai as any).responses.parse({
      model: OPENAI_MODEL,
      temperature: 0,
      reasoning: getOpenAIReasoning(),
      input: [
        {
          role: 'system',
          content:
            'You are an evidence-first analyst. Only use the provided snippets as sources. ' +
            'Cite snippet_ids for every fact. If no evidence exists, return null.',
        },
        { role: 'user', content: prompt },
      ],
      text: {
        format: zodTextFormat(schema, 'dd_extraction'),
      },
    });

    if (!response?.output_parsed) {
      return { facts, contradictions: [], artifactRegister: [] };
    }

    const parsed = response.output_parsed;

    // Process extracted facts with citation integrity
    for (const [code, extraction] of Object.entries(parsed.facts || {})) {
      const ext = extraction as { value: any; citations: string[]; notes?: string | null };
      const factDef = getFactByCode(code);
      if (!factDef) continue;

      // Validate citations exist in snippets
      const validCitations = (ext.citations || []).filter((c: string) => snippetIds.has(c));

      if (ext.value != null && validCitations.length > 0) {
        facts[code] = {
          value: ext.value,
          unit: factDef.unit,
          citations: validCitations,
          evidence_tier: 'OFFICIAL_UNSIGNED', // Default, can be upgraded based on artifact
          source_artifact_types: factDef.expected_artifacts,
          notes: ext.notes ?? null,
        };
      } else if (ext.value != null) {
        // Value without valid citation - null it out (citation integrity)
        facts[code] = createEmptyFactValue();
      }
    }

    // Process contradictions
    const contradictions: Contradiction[] = (parsed.contradictions || []).map((c: any) => ({
      fact_code: c.fact_code,
      severity: 'MEDIUM' as const,
      description: c.description,
      conflicting_candidates: (c.conflicting_values || []).map((v: any) => ({
        value: v.value,
        citations: (v.citations || []).filter((cit: string) => snippetIds.has(cit)),
      })),
    }));

    // Process artifact mentions
    const artifactRegister: ArtifactRegisterEntry[] = (parsed.artifact_mentions || [])
      .filter((a: any) => a.artifact_type && a.citations?.length > 0)
      .map((a: any) => ({
        artifact_type: a.artifact_type,
        evidence_tier: 'OFFICIAL_UNSIGNED' as const,
        issuer: a.issuer || null,
        date: a.date || null,
        key_fields: a.key_info ? { info: a.key_info } : {},
        citations: (a.citations || []).filter((c: string) => snippetIds.has(c)),
      }));

    return { facts, contradictions, artifactRegister };
  } catch (error) {
    console.error('Fact extraction error:', error);
    return { facts, contradictions: [], artifactRegister: [] };
  }
}

// ════════════════════════════════════════════════════════════════════════════
// MARKET CONTEXT (official sources only)
// ════════════════════════════════════════════════════════════════════════════

async function fetchMarketContext(
  country: string,
  allowedDomains: string[]
): Promise<MarketContext> {
  const base: MarketContext = {
    included: false,
    status: null,
    summary: null,
    sources: [],
    citations: [],
    disclaimer: MARKET_CONTEXT_DISCLAIMER,
  };

  if (!allowedDomains || allowedDomains.length === 0) {
    return { ...base, status: 'SKIPPED' };
  }

  const openaiClient = openai as any;
  if (!openaiClient?.responses?.create) {
    return { ...base, status: 'FAILED' };
  }

  const prompt = [
    `You are performing official-only market research for ${country}.`,
    'Only use government, regulator, system operator, or other official domains provided.',
    'Do NOT reference or infer details about any specific deal.',
    'Produce a concise, citation-rich summary that covers:',
    '1. Grid connection process for large loads',
    '2. Firmness/flex/non-firm mechanisms',
    '3. Queue/milestone/expiry rules',
    '4. Official artefacts that prove capacity reservation',
    'Cite sources inline using [1], [2] etc. Keep output under 200 words.',
  ].join('\n');

  try {
    const reasoning = getOpenAIReasoning();
    const response = await openaiClient.responses.create({
      model: OPENAI_MODEL,
      input: prompt,
      ...(reasoning && { reasoning }),
      tools: [{ type: 'web_search', filters: { allowed_domains: allowedDomains } }],
      include: ['web_search_call.action.sources'],
    });

    if (!response) {
      return { ...base, status: 'FAILED' };
    }

    const summary = extractTextFromResponse(response).trim();
    if (!summary) {
      return { ...base, status: 'FAILED' };
    }

    const sources = extractSourcesFromResponse(response)
      .map(normalizeUrlForClick)
      .filter(Boolean);
    const citations = extractCitationsFromSummary(summary, sources)
      .map(normalizeUrlForClick)
      .filter(Boolean);

    return {
      included: true,
      status: 'COMPLETED',
      summary,
      sources,
      citations,
      disclaimer: MARKET_CONTEXT_DISCLAIMER,
    };
  } catch {
    return { ...base, status: 'FAILED' };
  }
}

function extractTextFromResponse(response: any): string {
  if (!response) return '';
  if (typeof response.output_text === 'string') return response.output_text;
  const outputContent = (response.output || []).flatMap((o: any) => o?.content || []);
  const textChunk = outputContent.find(
    (c: any) => typeof c?.text === 'string' || typeof c?.output_text === 'string'
  );
  if (textChunk?.text) return textChunk.text;
  if (textChunk?.output_text) return textChunk.output_text;
  return '';
}

function collectSourcesFromValue(value: any, bucket: Set<string>): void {
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
    collectSourcesFromValue(
      (value as any).url || (value as any).link || (value as any).source || (value as any).href,
      bucket
    );
  }
}

function extractSourcesFromResponse(response: any): string[] {
  const sources = new Set<string>();
  collectSourcesFromValue(response?.web_search_call?.action?.sources, sources);
  const outputs = Array.isArray(response?.output) ? response.output : [];
  outputs.forEach((item: any) => {
    collectSourcesFromValue(item?.web_search_call?.action?.sources, sources);
    const content = Array.isArray(item?.content) ? item.content : [];
    content.forEach((c: any) =>
      collectSourcesFromValue(c?.web_search_call?.action?.sources, sources)
    );
  });
  return Array.from(sources.values()).filter(Boolean);
}

function extractCitationsFromSummary(summary: string, sources: string[]): string[] {
  const matches = Array.from(summary.matchAll(/\[(\d+)\]/g));
  const indices = Array.from(new Set(matches.map((m) => Number(m[1]))));
  return indices.map((idx) => sources[idx - 1]).filter(Boolean);
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN PIPELINE
// ════════════════════════════════════════════════════════════════════════════

export interface RunAnalysisV1Options {
  dealId: string;
  userId: string;
  organizationId: string;
  includeMarketContext?: boolean;
  fundPolicy?: FundPolicySnapshot;
}

export async function runAnalysisPipelineV1(
  options: RunAnalysisV1Options
): Promise<DDContractV1> {
  const { dealId, userId, organizationId, includeMarketContext = false, fundPolicy } = options;

  // Fetch deal with relations
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      fund: { include: { organization: { include: { countryPacks: true } } } },
      documents: true,
    },
  });

  if (!deal) throw new Error('Deal not found');
  if (deal.fund.organizationId !== organizationId) throw new Error('Forbidden');

  const modelInfo = getModelInfo();
  const effectivePolicy = fundPolicy ?? createDefaultFundPolicy();

  // 1. Retrieve evidence snippets
  const snippets = await retrieveEvidenceSnippetsV1(deal.openaiVectorStoreId || undefined);

  // 2. Extract facts with citation integrity
  const { facts, contradictions, artifactRegister } = await extractFactsV1(snippets);

  // 3. Run scoring pipeline
  const scoring = runScoringPipeline(facts, effectivePolicy);

  // 4. Fetch market context if requested
  let marketContext: MarketContext = {
    included: false,
    status: null,
    summary: null,
    sources: [],
    citations: [],
    disclaimer: MARKET_CONTEXT_DISCLAIMER,
  };

  if (includeMarketContext) {
    const countryPack = deal.fund.organization.countryPacks.find(
      (p) => p.countryCode.toLowerCase() === deal.country.toLowerCase()
    );
    const allowedDomains = sanitizeAllowedDomainsInput(countryPack?.allowedDomains || []).sanitized;
    marketContext = await fetchMarketContext(deal.country, allowedDomains);
  }

  // 5. Build DD Contract V1 output
  const ddContract: DDContractV1 = {
    contract_version: CONTRACT_VERSION,
    run_meta: {
      deal_id: deal.id,
      organization_id: organizationId,
      fund_id: deal.fundId,
      created_at: new Date().toISOString(),
      model_used: modelInfo.model,
      reasoning_effort: modelInfo.reasoningEffort,
      status: 'SUCCESS',
      error_message: null,
    },
    fund_policy_snapshot: effectivePolicy,
    deal_snapshot: {
      name: deal.name,
      country_code: deal.country,
      city: deal.city,
      deal_type: deal.type as any,
      product_type: deal.productType,
    },
    deal_evidence: {
      evidence_snippets: snippets,
      facts,
      artifact_register: artifactRegister,
      contradictions,
    },
    scoring: {
      hard_gate_result: scoring.hardGateResult,
      module_scorecard: scoring.moduleScorecard,
      overall: scoring.overallScore,
      energisation: scoring.energisation,
    },
    underwriting_tape: scoring.underwritingTape,
    checklist: scoring.checklist,
    market_context: marketContext,
  };

  // 6. Persist to database
  const run = await prisma.analysisRun.create({
    data: {
      dealId: deal.id,
      executedById: userId,
      evidence: { snippets: snippets.length, factCount: Object.keys(facts).length },
      scorecard: scoring.moduleScorecard,
      summary: scoring.overallScore.executive_summary,
      checklist: scoring.checklist,
      marketResearch: marketContext.included ? marketContext : undefined,
      marketResearchIncluded: marketContext.included,
      status: 'SUCCESS',
      errorMessage: null,
      modelUsed: modelInfo.model,
      reasoningEffort: modelInfo.reasoningEffort,
      // Store full DD Contract V1 output
      ddOntology: ddContract,
      moduleScores: scoring.moduleScorecard,
      contradictions: contradictions,
      redFlags: scoring.checklist.filter((c) => c.priority === 'CRITICAL'),
      energizationProbability: scoring.energisation,
      policyEvaluation: scoring.hardGateResult,
      underwritingTape: scoring.underwritingTape,
    },
  });

  // 7. Persist evidence snippets
  if (snippets.length > 0) {
    await prisma.analysisEvidenceSnippet.createMany({
      data: snippets.map((s) => ({
        analysisRunId: run.id,
        snippetId: s.snippet_id,
        text: s.text,
        fileId: s.source.deal_document_id,
        fileName: s.source.file_name,
        openaiFileId: s.openai.file_id,
        openaiVectorStoreId: s.openai.vector_store_id,
        score: s.retrieval.score,
        metadata: s.metadata,
      })),
      skipDuplicates: true,
    });
  }

  // 8. Audit log
  await prisma.auditLog.create({
    data: {
      action: 'ANALYSIS_RUN_V1',
      metadata: {
        dealId: deal.id,
        runId: run.id,
        contractVersion: CONTRACT_VERSION,
        hardGateDecision: scoring.hardGateResult.decision,
        overallScore: scoring.overallScore.score_0_100,
      },
      userId,
      organizationId,
    },
  });

  return ddContract;
}

// ════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════════════════

export { DDContractV1Schema };
