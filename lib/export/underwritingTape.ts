/**
 * UNDERWRITING TAPE EXPORT
 *
 * Generates a structured CSV/Excel-compatible export of deal analysis data
 * in a standardized format for investment committee review and pipeline tracking.
 */

import { prisma } from '../prisma';
import { UnderwritingTapeRow, ModuleStatus } from '../dd-ontology';

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
 */
function getFactByPath(run: any, variableId: string): { value: any; citations: string[]; confidence?: string } | null {
  // Check legacy evidence format
  const legacyFacts = run.evidence?.extracted_facts;
  if (legacyFacts && legacyFacts[variableId]) {
    return legacyFacts[variableId];
  }

  // Check DD ontology format
  const ddOntology = run.ddOntology;
  if (ddOntology) {
    // Map variable ID to module and field
    const moduleMap: Record<string, string> = {
      reserved_mw: 'power_grid',
      power_title_level: 'power_grid',
      firmness_type: 'power_grid',
      curtailment_cap_percent: 'power_grid',
      energization_target: 'power_grid',
      grid_connection_agreement: 'power_grid',
      deep_works_required: 'power_grid',
      queue_position: 'power_grid',
      land_control_type: 'permitting_land',
      land_area_sqm: 'permitting_land',
      building_permit_status: 'permitting_land',
      environmental_permit_status: 'permitting_land',
      zoning_status: 'permitting_land',
      total_it_capacity_mw: 'technical',
      pue_target: 'technical',
      tier_level: 'technical',
      total_capex_eur: 'technical',
      construction_duration_months: 'technical',
      anchor_tenant: 'commercial',
      loi_signed: 'commercial',
      loi_mw_total: 'commercial',
      contract_signed: 'commercial',
      pre_lease_percentage: 'commercial',
      target_price_eur_kw_month: 'commercial',
      fiber_providers_available: 'connectivity',
      distance_to_ix_km: 'connectivity',
      diverse_routes_available: 'connectivity',
      heat_reuse_obligation: 'esg',
      heat_reuse_plan: 'esg',
      renewable_energy_commitment: 'esg',
      ppa_in_place: 'esg',
    };

    const modKey = moduleMap[variableId];
    if (modKey && ddOntology[modKey] && ddOntology[modKey][variableId]) {
      return ddOntology[modKey][variableId];
    }
  }

  return null;
}

/**
 * Get summary/derived values
 */
function getSummaryValue(run: any, variableId: string): { value: any; status: string } | undefined {
  switch (variableId) {
    case 'overall_score':
      return {
        value: run.ddOntology?.overall_score ?? run.policyEvaluation?.weighted_score ?? null,
        status: 'VERIFIED',
      };
    case 'recommendation':
      return {
        value: run.policyEvaluation?.recommendation ?? null,
        status: run.policyEvaluation?.recommendation ? 'VERIFIED' : 'UNKNOWN',
      };
    case 'energization_probability_24m':
      return {
        value: run.energizationProbability?.t_24m ?? null,
        status: run.energizationProbability?.t_24m ? 'VERIFIED' : 'UNKNOWN',
      };
    case 'red_flag_count':
      return {
        value: (run.redFlags || []).length,
        status: 'VERIFIED',
      };
    case 'contradiction_count':
      return {
        value: (run.contradictions || []).length,
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
