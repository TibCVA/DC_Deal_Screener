import fs from 'fs';
import { prisma } from './prisma';
import { z } from 'zod';
import path from 'path';

export const ScoreStatusValues = {
  VERIFIED: 'VERIFIED',
  PARTIAL: 'PARTIAL',
  UNKNOWN: 'UNKNOWN',
} as const;

export const evidenceSchema = z.object({
  powerTitle: z.string(),
  reservedMw: z.string(),
  firmness: z.string(),
  energizationDate: z.string(),
  permits: z.string(),
  connectivity: z.string(),
  commercial: z.string(),
  citations: z.array(z.object({ field: z.string(), source: z.string(), snippet: z.string() })),
});

export const scorecardSchema = z.array(
  z.object({
    criterion: z.string(),
    status: z.nativeEnum(ScoreStatusValues),
    rationale: z.string(),
  })
);

export const checklistSchema = z.array(z.object({
  question: z.string(),
  priority: z.string(),
}));

export async function readDocumentContent(documentPath: string) {
  try {
    return fs.readFileSync(documentPath, 'utf-8');
  } catch (err) {
    return '';
  }
}

type Thesis = any;

type CountryPack = any;

function extractField(text: string, regex: RegExp) {
  const match = text.match(regex);
  return match ? match[0] : 'UNKNOWN';
}

function findSnippets(text: string, keywords: string[]) {
  const lower = text.toLowerCase();
  for (const k of keywords) {
    const idx = lower.indexOf(k.toLowerCase());
    if (idx !== -1) {
      const start = Math.max(0, idx - 40);
      const end = Math.min(text.length, idx + k.length + 60);
      return text.slice(start, end).trim();
    }
  }
  return '';
}

export async function runDeterministicAnalysis({
  dealId,
  userId,
}: {
  dealId: string;
  userId: string;
}) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      fund: true,
      documents: true,
      fund: { include: { organization: { include: { countryPacks: true } } } },
    },
  });
  if (!deal) throw new Error('Deal not found');
  const countryPack = deal.fund.organization.countryPacks.find((p) => p.countryCode === deal.country) ??
    deal.fund.organization.countryPacks[0];

  const contents = await Promise.all(
    deal.documents.map(async (doc) => ({
      id: doc.id,
      name: doc.name,
      text: await readDocumentContent(doc.path),
      path: doc.path,
    }))
  );
  const merged = contents.map((c) => c.text).join('\n');
  const evidence = {
    powerTitle: extractField(merged, /(220kv|110kv|grid connection|PPA)/i),
    reservedMw: extractField(merged, /(\d{1,3}\s?MW)/i),
    firmness: extractField(merged, /(firm|non-firm|flex)/i),
    energizationDate: extractField(merged, /(20\d{2}|Q\d\s?20\d{2})/i),
    permits: extractField(merged, /(permit|authori[sz]ation|consent)/i),
    connectivity: extractField(merged, /(fiber|backhaul|carrier|IX)/i),
    commercial: extractField(merged, /(LOI|contract|customer|pre-let|tenant)/i),
    citations: [] as { field: string; source: string; snippet: string }[],
  };

  const fields: [keyof typeof evidence, string[]][] = [
    ['powerTitle', ['grid', 'connection', '110kV', '220kV']],
    ['reservedMw', ['MW', 'megawatt']],
    ['firmness', ['firm', 'flex']],
    ['energizationDate', ['Q', '202', 'energ']],
    ['permits', ['permit', 'consent']],
    ['connectivity', ['fiber', 'carrier', 'IX']],
    ['commercial', ['contract', 'customer', 'LOI']],
  ];

  contents.forEach((doc) => {
    fields.forEach(([field, keywords]) => {
      const snippet = findSnippets(doc.text, keywords);
      if (snippet) {
        evidence.citations.push({ field, source: `${doc.name} (${path.basename(doc.path)})`, snippet });
      }
    });
  });

  const scorecard = [
    {
      criterion: 'Power reservation',
      status: evidence.reservedMw === 'UNKNOWN' ? ScoreStatusValues.UNKNOWN : ScoreStatusValues.VERIFIED,
      rationale: evidence.reservedMw === 'UNKNOWN' ? 'No proof of reserved MW.' : 'Reserved capacity evidenced in docs.',
    },
    {
      criterion: 'Firmness / flex terms',
      status: /non-firm|flex/i.test(evidence.firmness) ? ScoreStatusValues.PARTIAL : evidence.firmness === 'UNKNOWN' ? ScoreStatusValues.UNKNOWN : ScoreStatusValues.VERIFIED,
      rationale: evidence.firmness === 'UNKNOWN' ? 'Missing firmness terms.' : evidence.firmness,
    },
    {
      criterion: 'Permitting & land',
      status: evidence.permits === 'UNKNOWN' ? ScoreStatusValues.UNKNOWN : ScoreStatusValues.VERIFIED,
      rationale: evidence.permits,
    },
    {
      criterion: 'Connectivity',
      status: evidence.connectivity === 'UNKNOWN' ? ScoreStatusValues.UNKNOWN : ScoreStatusValues.VERIFIED,
      rationale: evidence.connectivity,
    },
    {
      criterion: 'Commercial traction',
      status: evidence.commercial === 'UNKNOWN' ? ScoreStatusValues.UNKNOWN : ScoreStatusValues.VERIFIED,
      rationale: evidence.commercial,
    },
  ];

  const checklist = [] as { question: string; priority: string }[];
  if (evidence.reservedMw === 'UNKNOWN') checklist.push({ question: 'Provide signed grid capacity reservation with title level.', priority: 'High' });
  if (evidence.firmness === 'UNKNOWN') checklist.push({ question: 'Confirm firmness/flex provisions and curtailment risks.', priority: 'High' });
  if (evidence.energizationDate === 'UNKNOWN') checklist.push({ question: 'Share energization milestone evidence with dates.', priority: 'Medium' });
  if (evidence.permits === 'UNKNOWN') checklist.push({ question: 'Provide permits/consents documentation.', priority: 'High' });
  if (evidence.connectivity === 'UNKNOWN') checklist.push({ question: 'Document fiber/backhaul providers and resilience.', priority: 'Medium' });
  if (evidence.commercial === 'UNKNOWN') checklist.push({ question: 'Evidence of customer traction (LOIs, contracts).', priority: 'High' });

  const confidence = computeEnergizationConfidence(evidence, checklist.length);
  const summary = `Evidence-led view: ${scorecard.filter((s) => s.status === ScoreStatusValues.VERIFIED).length} verified, ${scorecard.filter((s) => s.status === ScoreStatusValues.UNKNOWN).length} unknown. Energization confidence: ${confidence}%`;

  const validatedEvidence = evidenceSchema.parse(evidence);
  const validatedScorecard = scorecardSchema.parse(scorecard);
  const validatedChecklist = checklistSchema.parse(checklist);

  const run = await prisma.analysisRun.create({
    data: {
      dealId: deal.id,
      executedById: userId,
      evidence: validatedEvidence,
      scorecard: validatedScorecard,
      summary,
      checklist: validatedChecklist,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: 'ANALYSIS_RUN',
      metadata: { dealId: deal.id, runId: run.id },
      userId,
      organizationId: deal.fund.organizationId,
    },
  });

  return run;
}

export function computeEnergizationConfidence(evidence: z.infer<typeof evidenceSchema>, outstandingChecks: number) {
  let score = 30;
  if (evidence.reservedMw !== 'UNKNOWN') score += 20;
  if (!/non-firm|flex/i.test(evidence.firmness) && evidence.firmness !== 'UNKNOWN') score += 15;
  if (evidence.permits !== 'UNKNOWN') score += 15;
  if (evidence.connectivity !== 'UNKNOWN') score += 10;
  if (evidence.commercial !== 'UNKNOWN') score += 10;
  score -= outstandingChecks * 5;
  return Math.max(10, Math.min(95, score));
}
