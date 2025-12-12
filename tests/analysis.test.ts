import { describe, expect, it, vi } from 'vitest';

const snippetText = vi.hoisted(() => 'Grid connection reserved 24 MW at 110kV, firm, energization Q4 2025.');

vi.mock('../lib/openai', () => {
  const mockSearch = vi.fn().mockResolvedValue({
    data: [
      {
        id: 'hit1',
        text: snippetText,
        file_id: 'file-1',
        file_name: 'connection_letter.txt',
        score: 0.98,
        metadata: { page: 1 },
      },
    ],
  });
  const mockParse = vi.fn();
  return {
    openai: {
      vectorStores: { search: mockSearch },
      responses: { parse: mockParse },
    },
    OPENAI_MODEL: 'test-model',
    __mockSearch: mockSearch,
    __mockParse: mockParse,
  } as any;
});

vi.mock('../lib/prisma', () => {
  const runRecord: any = { runs: [] };
  const prisma = {
    deal: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'deal1',
        name: 'Paris South Campus',
        country: 'FR',
        city: 'Paris',
        productType: 'Hyperscale',
        type: 'GREENFIELD',
        fundId: 'fund1',
        documents: [],
        fund: {
          organizationId: 'org1',
          organization: { countryPacks: [{ id: 'pack1', countryCode: 'FR' }] },
        },
        openaiVectorStoreId: 'vs-123',
      }),
    },
    analysisRun: {
      create: vi.fn().mockImplementation(async ({ data }: any) => {
        const record = { ...data, id: `run-${runRecord.runs.length + 1}`, createdAt: new Date(), evidenceSnippets: [] };
        runRecord.runs.push(record);
        return record;
      }),
      findUnique: vi.fn().mockImplementation(async ({ where }: any) => {
        return runRecord.runs.find((r: any) => r.id === where.id);
      }),
    },
    analysisEvidenceSnippet: {
      createMany: vi.fn().mockImplementation(async ({ data }: any) => {
        const latest = runRecord.runs[runRecord.runs.length - 1];
        if (latest) {
          latest.evidenceSnippets = data.map((d: any, idx: number) => ({ ...d, id: `snip-${idx + 1}` }));
        }
        return { count: data.length };
      }),
      findMany: vi.fn().mockImplementation(async ({ where }: any) => {
        const latest = runRecord.runs[runRecord.runs.length - 1];
        if (!latest) return [];
        return (latest.evidenceSnippets || []).filter((s: any) => where.snippetId.in.includes(s.snippetId));
      }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit1' }),
    },
  } as any;
  return { prisma };
});

import { runDeterministicAnalysis, evidenceSchema, computeEnergizationConfidence, ScoreStatusValues, createSnippetId } from '../lib/analysis';
import { openai } from '../lib/openai';

describe('analysis engine', () => {
  it('validates evidence schema', () => {
    const parsed = evidenceSchema.parse({
      extracted_facts: {
        reserved_mw: { value: 24, citations: ['a'] },
        voltage_kv: { value: 110, citations: ['a'] },
        energization_target: { value: 'Q4 2025', citations: ['a'] },
        firmness_type: { value: 'firm', citations: ['a'] },
        curtailment_cap: { value: null, citations: [] },
        grid_title_artifact: { value: 'grid title', citations: ['a'] },
        permits_status: { value: 'Issued', citations: ['a'] },
        customer_traction: { value: 'LOI signed', citations: ['a'] },
      },
      checks: [],
    });
    expect(parsed.extracted_facts.voltage_kv.value).toBe(110);
  });

  it('runs deterministic analysis with fixture document', async () => {
    const snippetId = createSnippetId('file-1', snippetText);
    (openai as any).responses.parse.mockResolvedValue({
      extracted_facts: {
        reserved_mw: { value: 24, citations: [snippetId] },
        voltage_kv: { value: 110, citations: [snippetId] },
        energization_target: { value: 'Q4 2025', citations: [snippetId] },
        firmness_type: { value: 'firm', citations: [snippetId] },
        curtailment_cap: { value: null, citations: [] },
        grid_title_artifact: { value: 'Title deed shared', citations: [snippetId] },
        permits_status: { value: 'Permit granted', citations: [snippetId] },
        customer_traction: { value: 'Anchor LOI signed', citations: [snippetId] },
      },
      checks: [],
    });

    const run = await runDeterministicAnalysis({ dealId: 'deal1', userId: 'user1', organizationId: 'org1' });
    const evidence = (run as any).evidence as any;
    expect(evidence.extracted_facts.reserved_mw.value).toBe(24);
    expect(run.status).toBe('SUCCESS');
    const scorecard = run.scorecard as any[];
    expect(scorecard.find((s) => s.criterion === 'Power reservation')?.status).toBe(ScoreStatusValues.VERIFIED);
    const confidence = computeEnergizationConfidence(evidence.extracted_facts, (run.checklist as any[]).length);
    expect(confidence).toBeGreaterThan(10);
    expect((run as any).evidenceSnippets?.length).toBeGreaterThan(0);
    const snippetIds = new Set((run as any).evidenceSnippets.map((s: any) => s.snippetId));
    expect(snippetIds.has(snippetId)).toBe(true);
  });

  it('downgrades facts without citations and adds checklist items', async () => {
    (openai as any).responses.parse.mockResolvedValue({
      extracted_facts: {
        reserved_mw: { value: 10, citations: [] },
        voltage_kv: { value: null, citations: [] },
        energization_target: { value: null, citations: [] },
        firmness_type: { value: 'firm', citations: [] },
        curtailment_cap: { value: null, citations: [] },
        grid_title_artifact: { value: null, citations: [] },
        permits_status: { value: null, citations: [] },
        customer_traction: { value: null, citations: [] },
      },
      checks: [],
    });

    const run = await runDeterministicAnalysis({ dealId: 'deal1', userId: 'user1', organizationId: 'org1' });
    const evidence = (run as any).evidence as any;
    expect(evidence.extracted_facts.reserved_mw.value).toBeNull();
    const checklist = run.checklist as any[];
    expect(checklist.some((item) => (item.question as string).includes('missing citation integrity'))).toBe(true);
  });

  it('records failed run when OpenAI extraction throws', async () => {
    (openai as any).responses.parse.mockRejectedValue(new Error('model down'));
    const run = await runDeterministicAnalysis({ dealId: 'deal1', userId: 'user1', organizationId: 'org1' });
    expect(run.status).toBe('FAILED');
    expect((run as any).errorMessage).toMatch(/model down/);
  });
});
