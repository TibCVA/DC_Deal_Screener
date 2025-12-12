import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma', () => {
  const path = require('path');
  const fixturePath = path.join(__dirname, '../fixtures/connection_letter.txt');
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
        documents: [{ id: 'doc1', name: 'connection_letter.txt', path: fixturePath, mimeType: 'text/plain' }],
        fund: {
          organizationId: 'org1',
          organization: { countryPacks: [{ id: 'pack1', countryCode: 'FR' }] },
        },
      }),
    },
    analysisRun: {
      create: vi.fn().mockImplementation(async ({ data }: any) => {
        const record = { ...data, id: `run-${runRecord.runs.length + 1}`, createdAt: new Date() };
        runRecord.runs.push(record);
        return record;
      }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit1' }),
    },
  } as any;
  return { prisma };
});

import { runDeterministicAnalysis, evidenceSchema, computeEnergizationConfidence, ScoreStatusValues } from '../lib/analysis';

describe('analysis engine', () => {
  it('validates evidence schema', () => {
    const parsed = evidenceSchema.parse({
      powerTitle: '110kV',
      reservedMw: '24 MW',
      firmness: 'Firm',
      energizationDate: 'Q4 2025',
      permits: 'Permit 123',
      connectivity: 'Fiber',
      commercial: 'LOI',
      citations: [],
    });
    expect(parsed.powerTitle).toBe('110kV');
  });

  it('runs deterministic analysis with fixture document', async () => {
    const run = await runDeterministicAnalysis({ dealId: 'deal1', userId: 'user1', organizationId: 'org1' });
    const evidence = run.evidence as any;
    expect(evidence.reservedMw).toContain('MW');
    expect(run.scorecard).toBeDefined();
    const scorecard = run.scorecard as any[];
    expect(scorecard.find((s) => s.criterion === 'Power reservation')?.status).toBe(ScoreStatusValues.VERIFIED);
    const confidence = computeEnergizationConfidence(evidence, (run.checklist as any[]).length);
    expect(confidence).toBeGreaterThan(10);
  });
});
