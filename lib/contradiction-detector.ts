/**
 * CONTRADICTION & RED FLAG DETECTOR
 *
 * Analyzes extracted evidence to identify:
 * - Contradictions: Same fact with different values across documents
 * - Red flags: Warning signs that require immediate attention
 * - Inconsistencies: Logical problems in the evidence
 */

import { z } from 'zod';
import { EvidenceSnippet } from './analysis';
import { ContradictionType, RedFlagType } from './dd-ontology';

// ════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════

export interface ContradictionCheckResult {
  contradictions: ContradictionType[];
  warnings: string[];
}

export interface RedFlagCheckResult {
  redFlags: RedFlagType[];
  totalSeverityScore: number;
}

// ════════════════════════════════════════════════════════════════════════════
// CONTRADICTION DETECTION RULES
// ════════════════════════════════════════════════════════════════════════════

/**
 * Fields to check for contradictions
 */
const CONTRADICTION_CHECKS = [
  {
    factKey: 'reserved_mw',
    displayName: 'Reserved MW',
    tolerance: 0.05, // 5% tolerance for numerical values
    type: 'numeric',
  },
  {
    factKey: 'voltage_kv',
    displayName: 'Voltage (kV)',
    tolerance: 0,
    type: 'numeric',
  },
  {
    factKey: 'energization_target',
    displayName: 'Energization Date',
    tolerance: 0, // Dates must match exactly
    type: 'date',
  },
  {
    factKey: 'firmness_type',
    displayName: 'Firmness Type',
    tolerance: 0,
    type: 'enum',
  },
  {
    factKey: 'land_area_sqm',
    displayName: 'Land Area (sqm)',
    tolerance: 0.1, // 10% tolerance
    type: 'numeric',
  },
  {
    factKey: 'total_it_capacity_mw',
    displayName: 'IT Capacity (MW)',
    tolerance: 0.05,
    type: 'numeric',
  },
  {
    factKey: 'total_capex_eur',
    displayName: 'Total Capex (EUR)',
    tolerance: 0.1, // 10% tolerance for capex
    type: 'numeric',
  },
];

/**
 * Detect contradictions in extracted facts
 */
export function detectContradictions(
  snippets: EvidenceSnippet[],
  extractedFacts: Record<string, any>
): ContradictionCheckResult {
  const contradictions: ContradictionType[] = [];
  const warnings: string[] = [];

  // Group snippets by the facts they relate to
  const factValuesBySource = new Map<string, Array<{ value: any; source: string; snippetId: string }>>();

  for (const snippet of snippets) {
    // Parse snippet to look for numerical values
    const parsedValues = parseSnippetForValues(snippet);

    for (const [factKey, value] of Object.entries(parsedValues)) {
      if (!factValuesBySource.has(factKey)) {
        factValuesBySource.set(factKey, []);
      }
      factValuesBySource.get(factKey)!.push({
        value,
        source: snippet.fileName || 'Unknown document',
        snippetId: snippet.snippetId,
      });
    }
  }

  // Check for contradictions
  for (const check of CONTRADICTION_CHECKS) {
    const values = factValuesBySource.get(check.factKey);
    if (!values || values.length < 2) continue;

    // Get unique values
    const uniqueValues = new Map<string, typeof values[0]>();
    for (const v of values) {
      const key = normalizeValue(v.value, check.type);
      if (!uniqueValues.has(key)) {
        uniqueValues.set(key, v);
      }
    }

    if (uniqueValues.size > 1) {
      // Check if within tolerance
      if (check.type === 'numeric' && check.tolerance > 0) {
        const numValues = Array.from(uniqueValues.values()).map(v => parseFloat(v.value));
        const max = Math.max(...numValues);
        const min = Math.min(...numValues);
        const variance = (max - min) / max;

        if (variance <= check.tolerance) {
          warnings.push(`${check.displayName}: Values vary within tolerance (${(variance * 100).toFixed(1)}%)`);
          continue;
        }
      }

      // Real contradiction found
      contradictions.push({
        fact_key: check.factKey,
        values_found: Array.from(uniqueValues.values()).map(v => ({
          value: v.value,
          source: v.source,
          snippet_id: v.snippetId,
        })),
        severity: getSeverityForContradiction(check.factKey),
        resolution_needed: `Clarify the correct ${check.displayName} value. Documents show conflicting information.`,
      });
    }
  }

  return { contradictions, warnings };
}

/**
 * Parse snippet text to extract values
 */
function parseSnippetForValues(snippet: EvidenceSnippet): Record<string, any> {
  const values: Record<string, any> = {};
  const text = snippet.text.toLowerCase();

  // MW patterns
  const mwPatterns = [
    /(\d+(?:\.\d+)?)\s*mw/gi,
    /(\d+(?:\.\d+)?)\s*megawatt/gi,
    /capacity[:\s]+(\d+(?:\.\d+)?)/gi,
  ];
  for (const pattern of mwPatterns) {
    const match = text.match(pattern);
    if (match) {
      const num = parseFloat(match[1] || match[0].replace(/[^\d.]/g, ''));
      if (num > 0 && num < 1000) { // Reasonable MW range
        values.reserved_mw = num;
        break;
      }
    }
  }

  // kV patterns
  const kvPatterns = [
    /(\d+)\s*kv/gi,
    /(\d+)\s*kilovolt/gi,
    /voltage[:\s]+(\d+)/gi,
  ];
  for (const pattern of kvPatterns) {
    const match = text.match(pattern);
    if (match) {
      const num = parseFloat(match[1] || match[0].replace(/[^\d]/g, ''));
      if ([11, 33, 66, 110, 132, 220, 275, 380, 400].includes(num)) {
        values.voltage_kv = num;
        break;
      }
    }
  }

  // Date patterns for energization
  const datePatterns = [
    /energi[sz]ation[:\s]+(\d{4}[-/]\d{2}[-/]\d{2})/gi,
    /cod[:\s]+(\d{4}[-/]\d{2}[-/]\d{2})/gi,
    /q[1-4]\s*(\d{4})/gi,
  ];
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      values.energization_target = match[1];
      break;
    }
  }

  return values;
}

/**
 * Normalize value for comparison
 */
function normalizeValue(value: any, type: string): string {
  if (value === null || value === undefined) return 'null';

  switch (type) {
    case 'numeric':
      return String(Math.round(parseFloat(value) * 100) / 100);
    case 'date':
      return String(value).replace(/[\/\-]/g, '-').toLowerCase();
    case 'enum':
      return String(value).toLowerCase().trim();
    default:
      return String(value).toLowerCase().trim();
  }
}

/**
 * Get severity for contradiction type
 */
function getSeverityForContradiction(factKey: string): 'HIGH' | 'MEDIUM' | 'LOW' {
  const highSeverity = ['reserved_mw', 'firmness_type', 'energization_target'];
  const mediumSeverity = ['voltage_kv', 'total_it_capacity_mw', 'land_area_sqm'];

  if (highSeverity.includes(factKey)) return 'HIGH';
  if (mediumSeverity.includes(factKey)) return 'MEDIUM';
  return 'LOW';
}

// ════════════════════════════════════════════════════════════════════════════
// RED FLAG DETECTION RULES
// ════════════════════════════════════════════════════════════════════════════

/**
 * Red flag detection rules
 */
const RED_FLAG_RULES = [
  {
    id: 'no_signed_agreement',
    name: 'Missing Signed Grid Agreement',
    check: (facts: any) => !facts.grid_connection_agreement?.value,
    severity: 'HIGH' as const,
    description: 'No evidence of signed grid connection agreement found',
    recommendation: 'Request copy of executed grid connection agreement with signature pages',
  },
  {
    id: 'non_firm_high_mw',
    name: 'High Capacity Non-Firm Connection',
    check: (facts: any) => {
      const mw = facts.reserved_mw?.value || 0;
      const firmness = facts.firmness_type?.value;
      return mw > 30 && (firmness === 'non_firm' || firmness === 'flex' || firmness === 'interruptible');
    },
    severity: 'HIGH' as const,
    description: 'Large capacity reservation with non-firm connection terms',
    recommendation: 'Assess curtailment risk and impact on business case. Consider firmness upgrade path.',
  },
  {
    id: 'deep_works_no_timeline',
    name: 'Deep Works Without Timeline',
    check: (facts: any) => facts.deep_works_required?.value === true && !facts.deep_works_timeline_months?.value,
    severity: 'MEDIUM' as const,
    description: 'Grid reinforcement required but no completion timeline provided',
    recommendation: 'Request detailed timeline and milestones for grid reinforcement works',
  },
  {
    id: 'queue_expiry_risk',
    name: 'Queue Position Expiry Risk',
    check: (facts: any) => {
      const expiry = facts.queue_expiry_date?.value;
      if (!expiry) return false;
      const expiryDate = new Date(expiry);
      const now = new Date();
      const monthsRemaining = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30);
      return monthsRemaining < 6;
    },
    severity: 'CRITICAL' as const,
    description: 'Grid queue position expires within 6 months',
    recommendation: 'Urgent: Verify milestone requirements and ensure compliance to maintain queue position',
  },
  {
    id: 'no_land_control',
    name: 'No Land Control Evidence',
    check: (facts: any) => !facts.land_control_type?.value || facts.land_control_type?.value === 'none',
    severity: 'HIGH' as const,
    description: 'No evidence of land control (lease, option, or ownership)',
    recommendation: 'Request land title or lease documentation',
  },
  {
    id: 'permit_expired',
    name: 'Building Permit Expired or Expiring',
    check: (facts: any) => {
      const expiry = facts.building_permit_expiry?.value;
      if (!expiry) return false;
      const expiryDate = new Date(expiry);
      return expiryDate < new Date();
    },
    severity: 'CRITICAL' as const,
    description: 'Building permit has expired or is about to expire',
    recommendation: 'Verify permit status and renewal timeline with planning authority',
  },
  {
    id: 'no_customer_traction',
    name: 'No Commercial Traction',
    check: (facts: any) => !facts.anchor_tenant?.value && !facts.loi_signed?.value && !facts.contract_signed?.value,
    severity: 'MEDIUM' as const,
    description: 'No evidence of customer interest (LOI or contract)',
    recommendation: 'Request customer pipeline information and any expressions of interest',
  },
  {
    id: 'appeal_risk',
    name: 'Permit Appeal Risk',
    check: (facts: any) => facts.permit_appeal_risk?.value === true || facts.neighbor_opposition?.value === true,
    severity: 'HIGH' as const,
    description: 'Potential for permit challenge or neighbor opposition identified',
    recommendation: 'Assess appeal risk, timeline impact, and mitigation strategies',
  },
  {
    id: 'document_authenticity',
    name: 'Document Authenticity Concern',
    check: (facts: any, meta: any) => {
      // Check for documents without signatures or official stamps
      return meta?.unsigned_documents > 0;
    },
    severity: 'MEDIUM' as const,
    description: 'Some documents appear to be unsigned drafts',
    recommendation: 'Request executed versions of all key agreements',
  },
  {
    id: 'timeline_inconsistent',
    name: 'Timeline Inconsistency',
    check: (facts: any) => {
      const energization = facts.energization_target?.value;
      const construction = facts.construction_start_date?.value;
      const duration = facts.construction_duration_months?.value;

      if (!energization || !construction || !duration) return false;

      const energDate = new Date(energization);
      const constDate = new Date(construction);
      const expectedEnd = new Date(constDate);
      expectedEnd.setMonth(expectedEnd.getMonth() + duration);

      // If expected construction end is after energization target
      return expectedEnd > energDate;
    },
    severity: 'HIGH' as const,
    description: 'Construction timeline does not align with energization target',
    recommendation: 'Reconcile project timeline and verify critical path milestones',
  },
];

/**
 * Detect red flags in analysis
 */
export function detectRedFlags(
  extractedFacts: Record<string, any>,
  metadata?: { unsigned_documents?: number }
): RedFlagCheckResult {
  const redFlags: RedFlagType[] = [];
  let totalSeverityScore = 0;

  const severityPoints = { CRITICAL: 30, HIGH: 20, MEDIUM: 10 };

  for (const rule of RED_FLAG_RULES) {
    try {
      if (rule.check(extractedFacts, metadata)) {
        redFlags.push({
          severity: rule.severity,
          type: rule.id,
          description: rule.description,
          affected_facts: getAffectedFacts(rule.id),
          recommendation: rule.recommendation,
        });
        totalSeverityScore += severityPoints[rule.severity];
      }
    } catch {
      // Rule check failed, skip
    }
  }

  return { redFlags, totalSeverityScore };
}

/**
 * Get affected facts for a red flag type
 */
function getAffectedFacts(ruleId: string): string[] {
  const factMap: Record<string, string[]> = {
    no_signed_agreement: ['grid_connection_agreement'],
    non_firm_high_mw: ['reserved_mw', 'firmness_type'],
    deep_works_no_timeline: ['deep_works_required', 'deep_works_timeline_months'],
    queue_expiry_risk: ['queue_expiry_date', 'queue_position'],
    no_land_control: ['land_control_type'],
    permit_expired: ['building_permit_status', 'building_permit_expiry'],
    no_customer_traction: ['anchor_tenant', 'loi_signed', 'contract_signed'],
    appeal_risk: ['permit_appeal_risk', 'neighbor_opposition'],
    timeline_inconsistent: ['energization_target', 'construction_start_date', 'construction_duration_months'],
  };

  return factMap[ruleId] || [];
}

// ════════════════════════════════════════════════════════════════════════════
// COMBINED ANALYSIS
// ════════════════════════════════════════════════════════════════════════════

export interface RiskAnalysisResult {
  contradictions: ContradictionType[];
  redFlags: RedFlagType[];
  warnings: string[];
  overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  summary: string;
}

/**
 * Run complete risk analysis
 */
export function analyzeRisks(
  snippets: EvidenceSnippet[],
  extractedFacts: Record<string, any>,
  metadata?: { unsigned_documents?: number }
): RiskAnalysisResult {
  const { contradictions, warnings } = detectContradictions(snippets, extractedFacts);
  const { redFlags, totalSeverityScore } = detectRedFlags(extractedFacts, metadata);

  // Calculate risk score
  const contradictionScore = contradictions.reduce((sum, c) => {
    const points = { HIGH: 15, MEDIUM: 10, LOW: 5 };
    return sum + points[c.severity];
  }, 0);

  const riskScore = Math.min(100, totalSeverityScore + contradictionScore);

  // Determine overall risk level
  let overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  if (riskScore >= 60 || redFlags.some(f => f.severity === 'CRITICAL')) {
    overallRiskLevel = 'CRITICAL';
  } else if (riskScore >= 40 || redFlags.filter(f => f.severity === 'HIGH').length >= 2) {
    overallRiskLevel = 'HIGH';
  } else if (riskScore >= 20 || redFlags.length > 0 || contradictions.length > 0) {
    overallRiskLevel = 'MEDIUM';
  } else {
    overallRiskLevel = 'LOW';
  }

  // Generate summary
  const summary = generateRiskSummary(contradictions, redFlags, overallRiskLevel);

  return {
    contradictions,
    redFlags,
    warnings,
    overallRiskLevel,
    riskScore,
    summary,
  };
}

/**
 * Generate risk summary text
 */
function generateRiskSummary(
  contradictions: ContradictionType[],
  redFlags: RedFlagType[],
  riskLevel: string
): string {
  const parts: string[] = [];

  if (contradictions.length > 0) {
    parts.push(`${contradictions.length} contradiction(s) detected in document evidence`);
  }

  if (redFlags.length > 0) {
    const critical = redFlags.filter(f => f.severity === 'CRITICAL').length;
    const high = redFlags.filter(f => f.severity === 'HIGH').length;

    if (critical > 0) {
      parts.push(`${critical} CRITICAL red flag(s) requiring immediate attention`);
    }
    if (high > 0) {
      parts.push(`${high} HIGH priority red flag(s)`);
    }
  }

  if (parts.length === 0) {
    return 'No significant contradictions or red flags identified.';
  }

  return `Risk Level: ${riskLevel}. ${parts.join('. ')}.`;
}
