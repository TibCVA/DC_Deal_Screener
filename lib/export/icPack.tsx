import { pdf, Document, Page, Text, View, StyleSheet, Link } from '@react-pdf/renderer';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { computeEnergizationConfidence, checklistSchema, evidenceSchema, scorecardSchema } from '../analysis';
import { prisma } from '../prisma';

export class AuthorizationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

type Evidence = z.infer<typeof evidenceSchema>;
type ScorecardItem = z.infer<typeof scorecardSchema>[number];
type ChecklistItem = z.infer<typeof checklistSchema>[number];
type MarketResearch =
  | { status: 'COMPLETED'; summary: string; sources: string[]; citations: string[]; officialChecks?: string[] }
  | { status: 'SKIPPED' | 'FAILED' | undefined; reason?: string; summary?: string; sources?: string[]; citations?: string[]; officialChecks?: string[] };

type BuildParams = { dealId: string; runId: string; userId: string };

type DealContext = Prisma.DealGetPayload<{ include: { fund: { include: { organization: true } }; documents: true } }>;

type RunContext = Prisma.AnalysisRunGetPayload<{ include: { evidenceSnippets: true } }>;

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 11,
    fontFamily: 'Helvetica',
    lineHeight: 1.4,
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#0f172a', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#475569', marginBottom: 12 },
  section: { marginBottom: 14 },
  sectionHeader: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginBottom: 6 },
  card: { border: '1pt solid #e2e8f0', borderRadius: 6, padding: 8, marginBottom: 6 },
  label: { fontWeight: 'bold', color: '#0f172a' },
  text: { color: '#0f172a' },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: '#e2e8f0', fontSize: 10 },
  small: { fontSize: 10, color: '#475569' },
  divider: { borderBottom: '1pt solid #e2e8f0', marginVertical: 12 },
  listItem: { marginBottom: 4 },
  appendixHeader: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 8 },
});

function formatDateTime(value: Date) {
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatCitations(citations?: string[]) {
  if (!citations || citations.length === 0) return '';
  return citations.map((c) => `[SNP-${c.slice(0, 8)}]`).join(' ');
}

function collectCitedSnippetIds(evidence: Evidence, scorecard: ScorecardItem[]) {
  const ids = new Set<string>();
  Object.values(evidence.extracted_facts || {}).forEach((fact: any) => {
    (fact?.citations || []).forEach((c: string) => ids.add(c));
  });
  scorecard.forEach((item) => (item.citations || []).forEach((c) => ids.add(c)));
  return ids;
}

function truncateText(text: string, maxLength = 1200) {
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function renderKeyValue(label: string, value: string | number | null | undefined) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <Text style={[styles.text, { marginBottom: 2 }]}>
      <Text style={styles.label}>{label}: </Text>
      {String(value)}
    </Text>
  );
}

function buildThesisSummary(thesis: Record<string, any>) {
  const summaryParts = [
    thesis?.markets ? `Markets: ${thesis.markets}` : null,
    thesis?.productFocus ? `Product focus: ${thesis.productFocus}` : null,
    thesis?.riskAppetite ? `Risk: ${thesis.riskAppetite}` : null,
    thesis?.evidenceLevel ? `Evidence bar: ${thesis.evidenceLevel}` : null,
  ].filter(Boolean);
  return summaryParts.join(' • ');
}

function buildDocument({
  deal,
  run,
  evidence,
  scorecard,
  checklist,
  marketResearch,
  citedSnippets,
  otherSnippets,
}: {
  deal: NonNullable<DealContext>;
  run: NonNullable<RunContext>;
  evidence: Evidence;
  scorecard: ScorecardItem[];
  checklist: ChecklistItem[];
  marketResearch?: MarketResearch | null;
  citedSnippets: RunContext['evidenceSnippets'];
  otherSnippets: RunContext['evidenceSnippets'];
}) {
  const confidence = computeEnergizationConfidence(evidence.extracted_facts, checklist);
  const thesisSummary = buildThesisSummary((deal.fund.thesis as any) || {});
  const checklistItems = checklist || [];
  const marketIncluded = Boolean(run.marketResearchIncluded);
  const runStatusLabel = run.status === 'FAILED' ? 'Failed' : 'Success';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.title}>DC Deal Screener</Text>
          <Text style={styles.subtitle}>Investment Committee Pack</Text>
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>Deal overview</Text>
            {renderKeyValue('Deal', `${deal.name} (${deal.country} • ${deal.city})`)}
            {renderKeyValue('Deal type', deal.type)}
            {renderKeyValue('Product type', deal.productType)}
            {renderKeyValue('Fund', deal.fund.name)}
            {thesisSummary && renderKeyValue('Thesis', thesisSummary)}
            {renderKeyValue('Run timestamp', formatDateTime(run.createdAt))}
            {renderKeyValue('Run status', runStatusLabel)}
            {renderKeyValue('Model', run.modelUsed || 'n/a')}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Executive summary</Text>
          <Text style={styles.text}>{run.summary}</Text>
          <Text style={[styles.text, { marginTop: 4 }]}>Energization confidence: {confidence}%</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Scorecard</Text>
          {scorecard.map((item, idx) => (
            <View key={`${item.criterion}-${idx}`} style={styles.card}>
              <Text style={styles.label}>{item.criterion}</Text>
              <Text style={styles.text}>Status: {item.status}</Text>
              <Text style={[styles.text, { marginTop: 2 }]}>{item.rationale}</Text>
              {item.citations && item.citations.length > 0 && (
                <Text style={[styles.small, { marginTop: 2 }]}>Citations: {formatCitations(item.citations)}</Text>
              )}
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Checklist</Text>
          {checklistItems.map((item, idx) => (
            <View key={`${item.question}-${idx}`} style={styles.card}>
              <Text style={styles.label}>{item.question}</Text>
              <Text style={styles.text}>Priority: {item.priority}</Text>
              {item.requested_artifact && (
                <Text style={styles.text}>Requested artifact: {item.requested_artifact}</Text>
              )}
              {item.why && <Text style={styles.text}>Why: {item.why}</Text>}
            </View>
          ))}
          {checklistItems.length === 0 && <Text style={styles.small}>No outstanding items.</Text>}
        </View>

        <View style={styles.divider} />
        <View style={styles.section}>
          <Text style={styles.appendixHeader}>Appendix A — Evidence binder</Text>
          <Text style={[styles.small, { marginBottom: 6 }]}>Audit-ready snippets cited across the scorecard.</Text>
          {citedSnippets.map((snippet) => (
            <View key={snippet.id} style={styles.card}>
              <Text style={styles.label}>Snippet {snippet.snippetId}</Text>
              {snippet.fileName && <Text style={styles.text}>Source: {snippet.fileName}</Text>}
              {typeof snippet.score === 'number' && (
                <Text style={styles.text}>Score: {snippet.score.toFixed(3)}</Text>
              )}
              <Text style={[styles.text, { marginTop: 4 }]}>{truncateText(snippet.text)}</Text>
              {snippet.metadata && (
                <View style={{ marginTop: 4 }}>
                  <Text style={styles.small}>Metadata:</Text>
                  {Object.entries(snippet.metadata as Record<string, any>).map(([key, value]) => (
                    <Text key={key} style={styles.small}>
                      • {key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          ))}
          {citedSnippets.length === 0 && <Text style={styles.small}>No snippets cited.</Text>}

          {otherSnippets.length > 0 && (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.label}>Other retrieved snippets</Text>
              {otherSnippets.map((snippet) => (
                <View key={snippet.id} style={styles.card}>
                  <Text style={styles.label}>Snippet {snippet.snippetId}</Text>
                  {snippet.fileName && <Text style={styles.text}>Source: {snippet.fileName}</Text>}
                  <Text style={[styles.text, { marginTop: 4 }]}>{truncateText(snippet.text)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {marketIncluded && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.appendixHeader}>Appendix B — Market context</Text>
            <Text style={styles.small}>
              Market context is derived from official sources and is not used as evidence for deal-specific facts.
            </Text>
            {marketResearch?.status === 'SKIPPED' && (
              <Text style={[styles.text, { marginTop: 4 }]}>Research skipped: {marketResearch.reason || 'Reason not provided'}.</Text>
            )}
            {marketResearch?.status === 'FAILED' && (
              <Text style={[styles.text, { marginTop: 4 }]}>Research failed: {marketResearch.reason || 'Unavailable'}.</Text>
            )}
            {marketResearch?.status === 'COMPLETED' && marketResearch.summary && (
              <View style={{ marginTop: 6 }}>
                <Text style={styles.text}>{marketResearch.summary}</Text>
                {marketResearch.citations && marketResearch.citations.length > 0 && (
                  <View style={{ marginTop: 4 }}>
                    <Text style={styles.label}>Citations / URLs</Text>
                    {marketResearch.citations.map((url) => (
                      <Link key={url} src={url} style={styles.text}>
                        {url}
                      </Link>
                    ))}
                  </View>
                )}
                {marketResearch.sources && marketResearch.sources.length > 0 && (
                  <View style={{ marginTop: 4 }}>
                    <Text style={styles.label}>Sources consulted</Text>
                    {marketResearch.sources.map((url) => (
                      <Link key={url} src={url} style={styles.text}>
                        {url}
                      </Link>
                    ))}
                  </View>
                )}
              </View>
            )}
            {marketIncluded && !marketResearch && (
              <Text style={[styles.text, { marginTop: 4 }]}>Market research requested but not available.</Text>
            )}
          </View>
        )}
      </Page>
    </Document>
  );
}

async function fetchContexts({ dealId, runId, userId }: BuildParams) {
  if (!userId) {
    throw new AuthorizationError('Unauthorized', 401);
  }

  const membership = await prisma.membership.findFirst({ where: { userId } });
  if (!membership) {
    throw new AuthorizationError('Membership required', 403);
  }

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { fund: { include: { organization: true } }, documents: true },
  });
  if (!deal) throw new Error('Deal not found');
  if (deal.fund.organizationId !== membership.organizationId) {
    throw new AuthorizationError('Forbidden', 403);
  }

  const run = await prisma.analysisRun.findUnique({ where: { id: runId }, include: { evidenceSnippets: true } });
  if (!run) throw new Error('Analysis run not found');
  if (run.dealId !== deal.id) {
    throw new AuthorizationError('Run does not belong to this deal', 403);
  }

  return { deal, run } as { deal: NonNullable<DealContext>; run: NonNullable<RunContext> };
}

export async function buildIcPackPdfBuffer({ dealId, runId, userId }: BuildParams): Promise<Buffer> {
  const { deal, run } = await fetchContexts({ dealId, runId, userId });

  const evidence = evidenceSchema.parse(run.evidence || {});
  const scorecard = scorecardSchema.parse(run.scorecard || []);
  const checklist = checklistSchema.parse(run.checklist || []);
  const citedIds = collectCitedSnippetIds(evidence, scorecard);

  const citedSnippets = run.evidenceSnippets.filter((s) => citedIds.has(s.snippetId));
  const otherSnippets = run.evidenceSnippets.filter((s) => !citedIds.has(s.snippetId));

  const document = buildDocument({
    deal,
    run,
    evidence,
    scorecard,
    checklist,
    marketResearch: (run.marketResearch as MarketResearch | null) || null,
    citedSnippets,
    otherSnippets,
  });

  const buffer = (await pdf(document).toBuffer()) as unknown as Buffer & { dealName?: string; runLabel?: string };
  buffer.dealName = deal.name;
  buffer.runLabel = run.id;
  return buffer;
}
