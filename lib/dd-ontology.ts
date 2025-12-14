/**
 * DD ONTOLOGY - Due Diligence Data Model
 *
 * This file defines the complete structured ontology for data center investment analysis.
 * It covers 6 modules that form a comprehensive pre-DD assessment:
 *
 * 1. POWER & GRID - Capacity reservation, firmness, connection status
 * 2. PERMITTING & LAND - Planning permissions, land control, zoning
 * 3. TECHNICAL & BUILDABILITY - Design, phasing, capex, constructability
 * 4. COMMERCIAL & GO-TO-MARKET - Pipeline, LOIs, pricing, absorption
 * 5. CONNECTIVITY - Carriers, fiber routes, network resiliency
 * 6. ESG & REGULATORY - Heat reuse, water, environmental constraints
 */

import { z } from 'zod';

// ════════════════════════════════════════════════════════════════════════════
// COMMON TYPES
// ════════════════════════════════════════════════════════════════════════════

export const FactWithCitations = z.object({
  value: z.union([z.string(), z.number(), z.boolean()]).nullable(),
  citations: z.array(z.string()).default([]),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).nullable().default(null),
  source_document: z.string().nullable().default(null),
});

export const ModuleStatus = z.enum(['VERIFIED', 'PARTIAL', 'UNKNOWN', 'RED_FLAG']);

export const Priority = z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);

export const CheckItem = z.object({
  priority: Priority,
  question: z.string(),
  why: z.string().nullable().default(null),
  requested_artifact: z.string().nullable().default(null),
  module: z.string().nullable().default(null),
  contextual: z.boolean().nullable().default(null),
});

export const RedFlag = z.object({
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM']),
  type: z.string(),
  description: z.string(),
  affected_facts: z.array(z.string()).default([]),
  recommendation: z.string(),
});

export const Contradiction = z.object({
  fact_key: z.string(),
  values_found: z.array(z.object({
    value: z.union([z.string(), z.number()]),
    source: z.string(),
    snippet_id: z.string().nullable().default(null),
  })),
  severity: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  resolution_needed: z.string(),
});

// ════════════════════════════════════════════════════════════════════════════
// MODULE 1: POWER & GRID
// ════════════════════════════════════════════════════════════════════════════

export const PowerGridFacts = z.object({
  // Capacity
  reserved_mw: FactWithCitations.extend({ value: z.number().nullable() }),
  contracted_mw: FactWithCitations.extend({ value: z.number().nullable() }),
  voltage_kv: FactWithCitations.extend({ value: z.number().nullable() }),

  // Connection status
  connection_type: FactWithCitations.extend({
    value: z.enum(['dedicated_substation', 'shared_substation', 'direct_hv', 'mv_connection', 'unknown']).nullable()
  }),
  grid_operator: FactWithCitations.extend({ value: z.string().nullable() }),

  // Firmness
  firmness_type: FactWithCitations.extend({
    value: z.enum(['firm', 'non_firm', 'flex', 'interruptible', 'unknown'])
  }),
  curtailment_cap_percent: FactWithCitations.extend({ value: z.number().nullable() }),
  curtailment_hours_year: FactWithCitations.extend({ value: z.number().nullable() }),

  // Timeline
  energization_target: FactWithCitations.extend({ value: z.string().nullable() }),
  grid_connection_date: FactWithCitations.extend({ value: z.string().nullable() }),

  // Title strength (0-5 scale)
  power_title_level: FactWithCitations.extend({
    value: z.number().min(0).max(5).nullable(),
  }),

  // Artifacts
  grid_connection_agreement: FactWithCitations.extend({ value: z.boolean().nullable() }),
  capacity_reservation_letter: FactWithCitations.extend({ value: z.boolean().nullable() }),
  deposit_proof: FactWithCitations.extend({ value: z.boolean().nullable() }),

  // Queue position
  queue_position: FactWithCitations.extend({ value: z.number().nullable() }),
  queue_expiry_date: FactWithCitations.extend({ value: z.string().nullable() }),
  milestone_next: FactWithCitations.extend({ value: z.string().nullable() }),
  milestone_deadline: FactWithCitations.extend({ value: z.string().nullable() }),

  // Deep works
  deep_works_required: FactWithCitations.extend({ value: z.boolean().nullable() }),
  deep_works_description: FactWithCitations.extend({ value: z.string().nullable() }),
  deep_works_cost_eur: FactWithCitations.extend({ value: z.number().nullable() }),
  deep_works_timeline_months: FactWithCitations.extend({ value: z.number().nullable() }),
});

// ════════════════════════════════════════════════════════════════════════════
// MODULE 2: PERMITTING & LAND
// ════════════════════════════════════════════════════════════════════════════

export const PermittingLandFacts = z.object({
  // Land control
  land_control_type: FactWithCitations.extend({
    value: z.enum(['freehold', 'leasehold', 'option', 'letter_of_intent', 'none', 'unknown']).nullable()
  }),
  land_area_sqm: FactWithCitations.extend({ value: z.number().nullable() }),
  lease_term_years: FactWithCitations.extend({ value: z.number().nullable() }),
  lease_expiry: FactWithCitations.extend({ value: z.string().nullable() }),

  // Zoning
  zoning_status: FactWithCitations.extend({
    value: z.enum(['data_center_approved', 'industrial_compatible', 'requires_change', 'unknown']).nullable()
  }),
  zoning_reference: FactWithCitations.extend({ value: z.string().nullable() }),

  // Building permit
  building_permit_status: FactWithCitations.extend({
    value: z.enum(['granted', 'applied', 'not_applied', 'unknown']).nullable()
  }),
  building_permit_date: FactWithCitations.extend({ value: z.string().nullable() }),
  building_permit_expiry: FactWithCitations.extend({ value: z.string().nullable() }),
  building_permit_reference: FactWithCitations.extend({ value: z.string().nullable() }),

  // Environmental
  environmental_permit_status: FactWithCitations.extend({
    value: z.enum(['granted', 'applied', 'not_required', 'unknown']).nullable()
  }),
  environmental_impact_assessment: FactWithCitations.extend({ value: z.boolean().nullable() }),

  // Other permits
  other_permits: z.array(z.object({
    name: z.string(),
    status: z.enum(['granted', 'applied', 'required', 'not_required']),
    reference: z.string().nullable(),
    expiry: z.string().nullable(),
  })).default([]),

  // Risks
  permit_appeal_risk: FactWithCitations.extend({ value: z.boolean().nullable() }),
  neighbor_opposition: FactWithCitations.extend({ value: z.boolean().nullable() }),
});

// ════════════════════════════════════════════════════════════════════════════
// MODULE 3: TECHNICAL & BUILDABILITY
// ════════════════════════════════════════════════════════════════════════════

export const TechnicalFacts = z.object({
  // Design
  total_it_capacity_mw: FactWithCitations.extend({ value: z.number().nullable() }),
  total_gross_area_sqm: FactWithCitations.extend({ value: z.number().nullable() }),
  pue_target: FactWithCitations.extend({ value: z.number().nullable() }),
  tier_level: FactWithCitations.extend({
    value: z.enum(['tier_1', 'tier_2', 'tier_3', 'tier_4', 'unknown']).nullable()
  }),
  cooling_type: FactWithCitations.extend({
    value: z.enum(['air', 'water', 'hybrid', 'liquid', 'unknown']).nullable()
  }),

  // Phasing
  number_of_phases: FactWithCitations.extend({ value: z.number().nullable() }),
  phase_1_mw: FactWithCitations.extend({ value: z.number().nullable() }),
  phase_1_delivery: FactWithCitations.extend({ value: z.string().nullable() }),

  // Capex
  total_capex_eur: FactWithCitations.extend({ value: z.number().nullable() }),
  capex_per_mw_eur: FactWithCitations.extend({ value: z.number().nullable() }),

  // Construction
  epc_contractor: FactWithCitations.extend({ value: z.string().nullable() }),
  construction_start_date: FactWithCitations.extend({ value: z.string().nullable() }),
  construction_duration_months: FactWithCitations.extend({ value: z.number().nullable() }),

  // Site constraints
  site_access_constraints: FactWithCitations.extend({ value: z.string().nullable() }),
  soil_conditions: FactWithCitations.extend({ value: z.string().nullable() }),
  flood_risk: FactWithCitations.extend({
    value: z.enum(['none', 'low', 'medium', 'high', 'unknown']).nullable()
  }),
});

// ════════════════════════════════════════════════════════════════════════════
// MODULE 4: COMMERCIAL & GO-TO-MARKET
// ════════════════════════════════════════════════════════════════════════════

export const CommercialFacts = z.object({
  // Customer pipeline
  anchor_tenant: FactWithCitations.extend({ value: z.string().nullable() }),
  anchor_tenant_mw: FactWithCitations.extend({ value: z.number().nullable() }),
  loi_signed: FactWithCitations.extend({ value: z.boolean().nullable() }),
  loi_mw_total: FactWithCitations.extend({ value: z.number().nullable() }),
  contract_signed: FactWithCitations.extend({ value: z.boolean().nullable() }),
  contract_mw_total: FactWithCitations.extend({ value: z.number().nullable() }),

  // Pricing
  target_price_eur_kw_month: FactWithCitations.extend({ value: z.number().nullable() }),
  market_rent_benchmark: FactWithCitations.extend({ value: z.number().nullable() }),

  // Go-to-market
  target_customer_segment: FactWithCitations.extend({
    value: z.enum(['hyperscale', 'enterprise', 'colocation', 'mixed', 'unknown']).nullable()
  }),
  pre_lease_percentage: FactWithCitations.extend({ value: z.number().nullable() }),

  // Absorption
  absorption_timeline_months: FactWithCitations.extend({ value: z.number().nullable() }),
  market_vacancy_rate: FactWithCitations.extend({ value: z.number().nullable() }),

  // Competition
  competing_projects: z.array(z.object({
    name: z.string(),
    operator: z.string().nullable(),
    mw_capacity: z.number().nullable(),
    delivery_date: z.string().nullable(),
  })).default([]),
});

// ════════════════════════════════════════════════════════════════════════════
// MODULE 5: CONNECTIVITY
// ════════════════════════════════════════════════════════════════════════════

export const ConnectivityFacts = z.object({
  // Fiber
  fiber_providers_available: FactWithCitations.extend({ value: z.number().nullable() }),
  fiber_providers_names: z.array(z.string()).default([]),
  dark_fiber_available: FactWithCitations.extend({ value: z.boolean().nullable() }),
  lit_services_available: FactWithCitations.extend({ value: z.boolean().nullable() }),

  // Distance to network
  distance_to_ix_km: FactWithCitations.extend({ value: z.number().nullable() }),
  nearest_ix: FactWithCitations.extend({ value: z.string().nullable() }),
  distance_to_pop_km: FactWithCitations.extend({ value: z.number().nullable() }),

  // Latency
  latency_to_major_hub_ms: FactWithCitations.extend({ value: z.number().nullable() }),
  major_hub_reference: FactWithCitations.extend({ value: z.string().nullable() }),

  // Route diversity
  diverse_routes_available: FactWithCitations.extend({ value: z.boolean().nullable() }),
  number_of_diverse_routes: FactWithCitations.extend({ value: z.number().nullable() }),

  // Contracts
  carrier_agreements_in_place: FactWithCitations.extend({ value: z.boolean().nullable() }),
});

// ════════════════════════════════════════════════════════════════════════════
// MODULE 6: ESG & REGULATORY
// ════════════════════════════════════════════════════════════════════════════

export const ESGFacts = z.object({
  // Heat reuse
  heat_reuse_obligation: FactWithCitations.extend({ value: z.boolean().nullable() }),
  heat_reuse_plan: FactWithCitations.extend({ value: z.string().nullable() }),
  district_heating_nearby: FactWithCitations.extend({ value: z.boolean().nullable() }),

  // Water
  water_usage_constraint: FactWithCitations.extend({ value: z.boolean().nullable() }),
  water_source: FactWithCitations.extend({
    value: z.enum(['municipal', 'well', 'recycled', 'none', 'unknown']).nullable()
  }),
  wue_target: FactWithCitations.extend({ value: z.number().nullable() }),

  // Energy
  renewable_energy_commitment: FactWithCitations.extend({ value: z.number().nullable() }),
  ppa_in_place: FactWithCitations.extend({ value: z.boolean().nullable() }),
  carbon_neutral_target_year: FactWithCitations.extend({ value: z.number().nullable() }),

  // Local constraints
  noise_restrictions: FactWithCitations.extend({ value: z.boolean().nullable() }),
  operating_hours_restrictions: FactWithCitations.extend({ value: z.boolean().nullable() }),
  height_restrictions_m: FactWithCitations.extend({ value: z.number().nullable() }),

  // Certifications
  target_certifications: z.array(z.string()).default([]),

  // Sovereignty
  data_sovereignty_requirements: FactWithCitations.extend({ value: z.string().nullable() }),
  local_ownership_requirement: FactWithCitations.extend({ value: z.boolean().nullable() }),
});

// ════════════════════════════════════════════════════════════════════════════
// COMPLETE DD ANALYSIS RESULT
// ════════════════════════════════════════════════════════════════════════════

export const ModuleScore = z.object({
  module: z.string(),
  status: ModuleStatus,
  score: z.number().min(0).max(100),
  rationale: z.string(),
  citations: z.array(z.string()).default([]),
  red_flags: z.array(RedFlag).default([]),
  key_facts_summary: z.record(z.string(), z.any()).default({}),
});

export const DDAnalysisResult = z.object({
  // Module facts
  power_grid: PowerGridFacts,
  permitting_land: PermittingLandFacts,
  technical: TechnicalFacts,
  commercial: CommercialFacts,
  connectivity: ConnectivityFacts,
  esg: ESGFacts,

  // Module scores
  module_scores: z.array(ModuleScore),

  // Overall
  overall_score: z.number().min(0).max(100),
  overall_status: ModuleStatus,

  // Contradictions detected
  contradictions: z.array(Contradiction).default([]),

  // Aggregated checklist
  checklist: z.array(CheckItem),

  // Energization probability
  energization_probability: z.object({
    t_12m: z.number().min(0).max(100),
    t_24m: z.number().min(0).max(100),
    t_36m: z.number().min(0).max(100),
    key_drivers: z.array(z.string()),
    key_risks: z.array(z.string()),
    scenario_base: z.string(),
    scenario_bear: z.string(),
    scenario_bull: z.string(),
  }),
});

// ════════════════════════════════════════════════════════════════════════════
// UNDERWRITING TAPE (EXPORT FORMAT)
// ════════════════════════════════════════════════════════════════════════════

export const UnderwritingTapeRow = z.object({
  variable: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]).nullable(),
  status: ModuleStatus,
  citations: z.array(z.string()),
  artifact_requested: z.string().nullable(),
  module: z.string(),
});

export const UnderwritingTape = z.array(UnderwritingTapeRow);

// ════════════════════════════════════════════════════════════════════════════
// POWER TITLE LEVEL DEFINITIONS
// ════════════════════════════════════════════════════════════════════════════

export const POWER_TITLE_LEVELS = {
  0: {
    name: 'No evidence',
    description: 'No grid connection documentation',
    typical_artifacts: [],
  },
  1: {
    name: 'Expression of interest',
    description: 'Initial inquiry or expression of interest submitted',
    typical_artifacts: ['Letter of inquiry', 'Email confirmation'],
  },
  2: {
    name: 'Queue position',
    description: 'Formal application submitted, position in queue confirmed',
    typical_artifacts: ['Application receipt', 'Queue confirmation letter'],
  },
  3: {
    name: 'Offer received',
    description: 'Connection offer received from grid operator',
    typical_artifacts: ['Connection offer', 'Technical study'],
  },
  4: {
    name: 'Offer accepted',
    description: 'Connection offer accepted, deposit paid',
    typical_artifacts: ['Signed acceptance', 'Deposit proof', 'Connection agreement'],
  },
  5: {
    name: 'Full title',
    description: 'Binding connection agreement with firm capacity',
    typical_artifacts: ['Binding connection agreement', 'Capacity reservation certificate'],
  },
} as const;

// ════════════════════════════════════════════════════════════════════════════
// RETRIEVAL QUERIES BY MODULE
// ════════════════════════════════════════════════════════════════════════════

export const RETRIEVAL_QUERIES_BY_MODULE = {
  power_grid: [
    'grid connection agreement OR grid contract OR connection offer',
    'reserved MW OR capacity reservation OR power capacity',
    'voltage kV OR connection voltage OR HV connection',
    'energization date OR COD OR commercial operation date',
    'firmness OR firm capacity OR non-firm OR flex connection',
    'curtailment cap OR curtailment limit OR interruptible',
    'grid connection deposit OR capacity deposit payment',
    'queue position OR connection queue OR grid queue',
    'deep reinforcement works OR grid upgrade OR network upgrade',
    'substation OR transformer OR HV infrastructure',
  ],
  permitting_land: [
    'building permit OR planning permission OR construction permit',
    'land lease OR freehold OR land acquisition OR land option',
    'zoning OR land use OR urban plan',
    'environmental permit OR environmental impact OR EIA',
    'land area OR plot size OR site area',
  ],
  technical: [
    'IT capacity OR IT load OR total MW',
    'PUE OR power usage effectiveness',
    'cooling system OR chiller OR CRAC OR cooling tower',
    'tier level OR tier 3 OR tier 4 OR redundancy',
    'construction cost OR capex OR capital expenditure',
    'EPC contractor OR construction contractor',
    'construction timeline OR delivery date OR completion date',
  ],
  commercial: [
    'anchor tenant OR customer OR hyperscaler',
    'LOI OR letter of intent OR pre-lease',
    'lease agreement OR customer contract',
    'pricing OR rent OR EUR per kW',
    'colocation OR wholesale OR retail',
  ],
  connectivity: [
    'fiber provider OR carrier OR network provider',
    'dark fiber OR lit services OR wavelength',
    'internet exchange OR IX OR peering',
    'latency OR network latency OR RTT',
    'diverse routes OR route diversity OR path diversity',
  ],
  esg: [
    'heat reuse OR waste heat OR district heating',
    'water usage OR WUE OR water consumption',
    'renewable energy OR PPA OR green energy',
    'carbon neutral OR net zero OR sustainability',
    'noise restriction OR environmental constraint',
  ],
};

// Type exports
export type FactWithCitationsType = z.infer<typeof FactWithCitations>;
export type ModuleStatusType = z.infer<typeof ModuleStatus>;
export type CheckItemType = z.infer<typeof CheckItem>;
export type RedFlagType = z.infer<typeof RedFlag>;
export type ContradictionType = z.infer<typeof Contradiction>;
export type PowerGridFactsType = z.infer<typeof PowerGridFacts>;
export type PermittingLandFactsType = z.infer<typeof PermittingLandFacts>;
export type TechnicalFactsType = z.infer<typeof TechnicalFacts>;
export type CommercialFactsType = z.infer<typeof CommercialFacts>;
export type ConnectivityFactsType = z.infer<typeof ConnectivityFacts>;
export type ESGFactsType = z.infer<typeof ESGFacts>;
export type ModuleScoreType = z.infer<typeof ModuleScore>;
export type DDAnalysisResultType = z.infer<typeof DDAnalysisResult>;
export type UnderwritingTapeRowType = z.infer<typeof UnderwritingTapeRow>;
export type UnderwritingTapeType = z.infer<typeof UnderwritingTape>;
