/**
 * UNDERWRITING TAPE EXPORT
 *
 * Generates a structured CSV/Excel-compatible export of deal analysis data
 * in a standardized format for investment committee review and pipeline tracking.
 *
 * Supports both legacy analysis format and DD Contract V1 format.
 */

import { prisma } from '../prisma';
import {
  type UnderwritingTapeVariable,
  type ModuleStatus,
  UNDERWRITING_TAPE_VARIABLES,
} from '../dd-contract-v1';

// ════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════

export interface TapeVariable {
  id: string;
  name: string;
  module: string;
  description: string;
  unit?: string;
  critical: boolean;
}

export interface TapeExportRow {
  deal_name: string;
  deal_id: string;
  country: string;
  city: string;
  deal_type: string;
  product_type: string;
  analysis_date: string;
  variable: string;
  variable_id: string;
  module: string;
  value: string | number | null;
  status: string;
  citations: string;
  artifact_requested: string | null;
  is_critical: boolean;
}

// ════════════════════════════════════════════════════════════════════════════
// STANDARD TAPE VARIABLES
// ════════════════════════════════════════════════════════════════════════════

export const TAPE_VARIABLES: TapeVariable[] = [
  // Power & Grid
  { id: 'reserved_mw', name: 'Reserved MW', module: 'power_grid', description: 'Contracted or reserved power capacity', unit: 'MW', critical: true },
  { id: 'power_title_level', name: 'Power Title Level', module: 'power_grid', description: 'Grid connection maturity (0-5 scale)', critical: true },
  { id: 'firmness_type', name: 'Firmness Type', module: 'power_grid', description: 'Connection firmness (firm/non_firm/flex)', critical: true },
  { id: 'curtailment_cap_percent', name: 'Curtailment Cap', module: 'power_grid', description: 'Maximum curtailment percentage', unit: '%', critical: false },
  { id: 'energization_target', name: 'Energization Target', module: 'power_grid', description: 'Expected energization date', critical: true },
  { id: 'grid_connection_agreement', name: 'Grid Agreement Signed', module: 'power_grid', description: 'Binding grid agreement in place', critical: true },
  { id: 'deep_works_required', name: 'Deep Works Required', module: 'power_grid', description: 'Grid reinforcement works needed', critical: false },
  { id: 'queue_position', name: 'Queue Position', module: 'power_grid', description: 'Position in connection queue', critical: false },

  // Permitting & Land
  { id: 'land_control_type', name: 'Land Control Type', module: 'permitting_land', description: 'Type of land control (freehold/leasehold/option)', critical: true },
  { id: 'land_area_sqm', name: 'Land Area', module: 'permitting_land', description: 'Total site area', unit: 'sqm', critical: false },
  { id: 'building_permit_status', name: 'Building Permit Status', module: 'permitting_land', description: 'Status of building permission', critical: true },
  { id: 'environmental_permit_status', name: 'Environmental Permit', module: 'permitting_land', description: 'Environmental authorization status', critical: false },
  { id: 'zoning_status', name: 'Zoning Status', module: 'permitting_land', description: 'Zoning compliance status', critical: false },

  // Technical
  { id: 'total_it_capacity_mw', name: 'Total IT Capacity', module: 'technical', description: 'Design IT load capacity', unit: 'MW', critical: false },
  { id: 'pue_target', name: 'PUE Target', module: 'technical', description: 'Target Power Usage Effectiveness', critical: false },
  { id: 'tier_level', name: 'Tier Level', module: 'technical', description: 'Data center tier classification', critical: false },
  { id: 'total_capex_eur', name: 'Total Capex', module: 'technical', description: 'Estimated total capital expenditure', unit: 'EUR', critical: false },
  { id: 'construction_duration_months', name: 'Construction Duration', module: 'technical', description: 'Expected construction timeline', unit: 'months', critical: false },

  // Commercial
  { id: 'anchor_tenant', name: 'Anchor Tenant', module: 'commercial', description: 'Primary customer name', critical: true },
  { id: 'loi_signed', name: 'LOI Signed', module: 'commercial', description: 'Letter of Intent executed', critical: true },
  { id: 'loi_mw_total', name: 'LOI MW Total', module: 'commercial', description: 'Total MW under LOI', unit: 'MW', critical: false },
  { id: 'contract_signed', name: 'Contract Signed', module: 'commercial', description: 'Binding lease/contract executed', critical: true },
  { id: 'pre_lease_percentage', name: 'Pre-Lease %', module: 'commercial', description: 'Percentage of capacity pre-leased', unit: '%', critical: false },
  { id: 'target_price_eur_kw_month', name: 'Target Price', module: 'commercial', description: 'Target rental rate', unit: 'EUR/kW/month', critical: false },

  // Connectivity
  { id: 'fiber_providers_available', name: 'Fiber Providers', module: 'connectivity', description: 'Number of fiber providers available', critical: false },
  { id: 'distance_to_ix_km', name: 'Distance to IX', module: 'connectivity', description: 'Distance to nearest Internet Exchange', unit: 'km', critical: false },
  { id: 'diverse_routes_available', name: 'Diverse Routes', module: 'connectivity', description: 'Multiple fiber routes available', critical: false },

  // ESG
  { id: 'heat_reuse_obligation', name: 'Heat Reuse Obligation', module: 'esg', description: 'Mandatory heat reuse requirement', critical: false },
  { id: 'heat_reuse_plan', name: 'Heat Reuse Plan', module: 'esg', description: 'Heat reuse strategy documented', critical: false },
  { id: 'renewable_energy_commitment', name: 'Renewable %', module: 'esg', description: 'Renewable energy commitment', unit: '%', critical: false },
  { id: 'ppa_in_place', name: 'PPA in Place', module: 'esg', description: 'Power Purchase Agreement signed', critical: false },

  // Derived/Summary
  { id: 'overall_score', name: 'Overall Score', module: 'summary', description: 'Weighted overall deal score', unit: '%', critical: true },
  { id: 'recommendation', name: 'Recommendation', module: 'summary', description: 'Policy recommendation (PROCEED/REVIEW/REJECT)', critical: true },
  { id: 'energization_probability_24m', name: 'P(Energization) 24m', module: 'summary', description: 'Probability of energization within 24 months', unit: '%', critical: true },
  { id: 'red_flag_count', name: 'Red Flags', module: 'summary', description: 'Number of red flags identified', critical: true },
  { id: 'contradiction_count', name: 'Contradictions', module: 'summary', description: 'Number of contradictions found', critical: false },
];

// ════════════════════════════════════════════════════════════════════════════
// EXPORT FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Extract tape data from an analysis run
 */
export function extractTapeFromAnalysis(
  run: {
    evidence: any;
    ddOntology?: any;
    moduleScores?: any;
    contradictions?: any;
    redFlags?: any;
    energizationProbability?: any;
    policyEvaluation?: any;
  },
  deal: {
    name: string;
    id: string;
    country: string;
    city: string;
    type: string;
    productType: string;
  },
  analysisDate: Date
): TapeExportRow[] {
  const rows: TapeExportRow[] = [];
  const facts = run.evidence?.extracted_facts || run.ddOntology?.power_grid || {};

  for (const variable of TAPE_VARIABLES) {
    let value: string | number | null = null;
    let status: string = 'UNKNOWN';
    let citations: string[] = [];
    let artifactRequested: string | null = null;

    // Extract value based on variable ID
    const factData = getFactByPath(run, variable.id);
    if (factData) {
      value = factData.value;
      citations = factData.citations || [];
      status = value !== null && value !== undefined ? 'VERIFIED' : 'UNKNOWN';
      if (factData.confidence === 'LOW') status = 'PARTIAL';
    }

    // Handle summary/derived fields
    if (variable.module === 'summary') {
      const summaryValue = getSummaryValue(run, variable.id);
      if (summaryValue !== undefined) {
        value = summaryValue.value;
        status = summaryValue.status;
      }
    }

    // Determine artifact requested if value is missing
    if (status === 'UNKNOWN') {
      artifactRequested = getRequiredArtifact(variable.id);
    }

    rows.push({
      deal_name: deal.name,
      deal_id: deal.id,
      country: deal.country,
      city: deal.city,
      deal_type: deal.type,
      product_type: deal.productType,
      analysis_date: analysisDate.toISOString().split('T')[0],
      variable: variable.name,
      variable_id: variable.id,
      module: variable.module,
      value: value,
      status: status,
      citations: citations.map(c => c.slice(0, 8)).join('; '),
      artifact_requested: artifactRequested,
      is_critical: variable.critical,
    });
  }

  return rows;
}

/**
 * Get fact by path from analysis data
 * Supports both legacy format and DD Contract V1 format
 */
function getFactByPath(run: any, variableId: string): { value: any; citations: string[]; confidence?: string } | null {
  // Check legacy evidence format
  const legacyFacts = run.evidence?.extracted_facts;
  if (legacyFacts && legacyFacts[variableId]) {
    return legacyFacts[variableId];
  }

  // Check DD Contract V1 format
  const ddOntology = run.ddOntology;
  if (ddOntology) {
    // V1 format: ddOntology.deal_evidence.facts[fact_code]
    const v1Facts = ddOntology.deal_evidence?.facts;
    if (v1Facts) {
      // Map tape variable ID to V1 fact code
      const v1FactMap: Record<string, string> = {
        reserved_mw: 'grid_reserved_mw_firm',
        power_title_level: 'grid_title_level_0_5',
        firmness_type: 'grid_reserved_mw_flex', // Check if flex > 0
        curtailment_cap_percent: 'grid_curtailment_cap',
        energization_target: 'grid_energisation_target',
        grid_connection_agreement: 'grid_title_level_0_5', // Level 4+ means signed
        deep_works_required: 'grid_deep_works_flag',
        queue_position: 'grid_next_milestone_or_expiry_date',
        land_control_type: 'land_control_type',
        building_permit_status: 'building_permit_status',
        environmental_permit_status: 'environmental_permit_status',
        anchor_tenant: 'target_customer_segment',
        loi_signed: 'anchor_customer_stage_0_4', // Stage 2+ means LOI
        loi_mw_total: 'prelet_mw',
        contract_signed: 'anchor_customer_stage_0_4', // Stage 3+ means contract
        pre_lease_percentage: 'prelet_mw',
        fiber_providers_available: 'carrier_count_confirmed',
        diverse_routes_available: 'diverse_routes_confirmed',
      };

      const factCode = v1FactMap[variableId] || variableId;
      if (v1Facts[factCode]) {
        return {
          value: v1Facts[factCode].value,
          citations: v1Facts[factCode].citations || [],
          confidence: v1Facts[factCode].evidence_tier,
        };
      }
    }

    // Also check underwriting_tape directly in V1 format
    const tape = ddOntology.underwriting_tape;
    if (Array.isArray(tape)) {
      const tapeVar = tape.find((t: any) => t.variable_code === variableId);
      if (tapeVar) {
        return {
          value: tapeVar.value,
          citations: tapeVar.citations || [],
        };
      }
    }
  }

  return null;
}

/**
 * Get summary/derived values from either legacy or V1 format
 */
function getSummaryValue(run: any, variableId: string): { value: any; status: string } | undefined {
  const ddOntology = run.ddOntology;

  switch (variableId) {
    case 'overall_score':
      // V1 format: ddOntology.scoring.overall.score_0_100
      // Legacy format: policyEvaluation.weighted_score
      const v1Score = ddOntology?.scoring?.overall?.score_0_100;
      const legacyScore = run.policyEvaluation?.weighted_score;
      return {
        value: v1Score ?? legacyScore ?? null,
        status: v1Score != null || legacyScore != null ? 'VERIFIED' : 'UNKNOWN',
      };

    case 'recommendation':
      // V1 format: ddOntology.scoring.hard_gate_result.decision
      // Legacy format: policyEvaluation.recommendation
      const v1Decision = ddOntology?.scoring?.hard_gate_result?.decision;
      const legacyRec = run.policyEvaluation?.recommendation;
      return {
        value: v1Decision ?? legacyRec ?? null,
        status: v1Decision || legacyRec ? 'VERIFIED' : 'UNKNOWN',
      };

    case 'energization_probability_24m':
      // V1 format: ddOntology.scoring.energisation.curve[1].p (24m is index 1)
      // Legacy format: energizationProbability.t_24m
      const v1Curve = ddOntology?.scoring?.energisation?.curve;
      const v1P24 = v1Curve?.find((c: any) => c.horizon_months === 24)?.p;
      const legacyP24 = run.energizationProbability?.t_24m;
      const p24Value = v1P24 != null ? Math.round(v1P24 * 100) : legacyP24;
      return {
        value: p24Value ?? null,
        status: p24Value != null ? 'VERIFIED' : 'UNKNOWN',
      };

    case 'red_flag_count':
      // V1 format: count checklist items with priority CRITICAL
      // Legacy format: redFlags array length
      const v1RedFlags = ddOntology?.checklist?.filter((c: any) => c.priority === 'CRITICAL') || [];
      const legacyRedFlags = run.redFlags || [];
      return {
        value: v1RedFlags.length || legacyRedFlags.length,
        status: 'VERIFIED',
      };

    case 'contradiction_count':
      // V1 format: ddOntology.deal_evidence.contradictions.length
      // Legacy format: contradictions array length
      const v1Contradictions = ddOntology?.deal_evidence?.contradictions || [];
      const legacyContradictions = run.contradictions || [];
      return {
        value: v1Contradictions.length || legacyContradictions.length,
        status: 'VERIFIED',
      };

    default:
      return undefined;
  }
}

/**
 * Get required artifact for missing variable
 */
function getRequiredArtifact(variableId: string): string | null {
  const artifactMap: Record<string, string> = {
    reserved_mw: 'Grid connection agreement or capacity reservation letter',
    power_title_level: 'Grid connection documentation showing status',
    firmness_type: 'Connection agreement with firmness terms',
    energization_target: 'Project timeline or grid connection schedule',
    grid_connection_agreement: 'Signed grid connection agreement',
    land_control_type: 'Lease agreement, option, or title deed',
    building_permit_status: 'Building permit or application receipt',
    anchor_tenant: 'Customer LOI or contract',
    loi_signed: 'Signed Letter of Intent',
    contract_signed: 'Executed lease or service agreement',
  };

  return artifactMap[variableId] || null;
}

/**
 * Convert rows to CSV format
 */
export function toCSV(rows: TapeExportRow[]): string {
  const headers = [
    'Deal Name',
    'Deal ID',
    'Country',
    'City',
    'Deal Type',
    'Product Type',
    'Analysis Date',
    'Variable',
    'Variable ID',
    'Module',
    'Value',
    'Status',
    'Citations',
    'Artifact Requested',
    'Is Critical',
  ];

  const csvRows = [headers.join(',')];

  for (const row of rows) {
    const values = [
      escapeCSV(row.deal_name),
      escapeCSV(row.deal_id),
      escapeCSV(row.country),
      escapeCSV(row.city),
      escapeCSV(row.deal_type),
      escapeCSV(row.product_type),
      escapeCSV(row.analysis_date),
      escapeCSV(row.variable),
      escapeCSV(row.variable_id),
      escapeCSV(row.module),
      row.value === null ? '' : escapeCSV(String(row.value)),
      escapeCSV(row.status),
      escapeCSV(row.citations),
      row.artifact_requested ? escapeCSV(row.artifact_requested) : '',
      row.is_critical ? 'TRUE' : 'FALSE',
    ];
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

/**
 * Escape value for CSV
 */
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Generate summary tape (one row per deal, critical variables only)
 */
export function toSummaryCSV(rows: TapeExportRow[]): string {
  // Get unique deals
  const dealIds = [...new Set(rows.map(r => r.deal_id))];

  // Critical variables to include
  const criticalVars = TAPE_VARIABLES.filter(v => v.critical).map(v => v.id);

  const headers = [
    'Deal Name',
    'Country',
    'City',
    'Deal Type',
    'Analysis Date',
    ...criticalVars.map(id => TAPE_VARIABLES.find(v => v.id === id)?.name || id),
  ];

  const csvRows = [headers.join(',')];

  for (const dealId of dealIds) {
    const dealRows = rows.filter(r => r.deal_id === dealId);
    if (dealRows.length === 0) continue;

    const first = dealRows[0];
    const values = [
      escapeCSV(first.deal_name),
      escapeCSV(first.country),
      escapeCSV(first.city),
      escapeCSV(first.deal_type),
      escapeCSV(first.analysis_date),
    ];

    for (const varId of criticalVars) {
      const varRow = dealRows.find(r => r.variable_id === varId);
      if (varRow && varRow.value !== null) {
        values.push(escapeCSV(`${varRow.value} [${varRow.status}]`));
      } else {
        values.push('UNKNOWN');
      }
    }

    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

/**
 * Build underwriting tape for a specific analysis run
 */
export async function buildUnderwritingTape(runId: string): Promise<{ csv: string; summary: string; rows: TapeExportRow[] }> {
  const run = await prisma.analysisRun.findUnique({
    where: { id: runId },
    include: {
      deal: true,
    },
  });

  if (!run) {
    throw new Error('Analysis run not found');
  }

  // Cast to any to access optional fields that may not exist in older schema
  const runData = run as any;

  const rows = extractTapeFromAnalysis(
    {
      evidence: run.evidence,
      ddOntology: runData.ddOntology,
      moduleScores: runData.moduleScores,
      contradictions: runData.contradictions,
      redFlags: runData.redFlags,
      energizationProbability: runData.energizationProbability,
      policyEvaluation: runData.policyEvaluation,
    },
    {
      name: run.deal.name,
      id: run.deal.id,
      country: run.deal.country,
      city: run.deal.city,
      type: run.deal.type,
      productType: run.deal.productType,
    },
    run.createdAt
  );

  return {
    csv: toCSV(rows),
    summary: toSummaryCSV(rows),
    rows,
  };
}
