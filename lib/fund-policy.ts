/**
 * FUND POLICY - Structured Investment Policy Configuration
 *
 * This file defines the structured policy schema that allows funds to configure:
 * - Hard gates (automatic deal rejection criteria)
 * - Module weights (scoring prioritization)
 * - Tolerances (acceptable ranges for key metrics)
 * - Required evidence levels (minimum documentation standards)
 */

import { z } from 'zod';

// ════════════════════════════════════════════════════════════════════════════
// HARD GATES - Automatic Deal Rejection Criteria
// ════════════════════════════════════════════════════════════════════════════

export const HardGates = z.object({
  // Power & Grid gates
  min_power_title_level: z.number().min(0).max(5).default(3),
  require_grid_connection_agreement: z.boolean().default(false),
  accept_non_firm_connection: z.boolean().default(true),
  accept_flex_connection: z.boolean().default(true),
  accept_interruptible_connection: z.boolean().default(false),
  max_curtailment_percent: z.number().min(0).max(100).nullable().default(null),
  max_queue_wait_months: z.number().nullable().default(null),
  reject_deep_works_required: z.boolean().default(false),

  // Permitting gates
  require_building_permit_granted: z.boolean().default(false),
  require_land_control: z.boolean().default(true),
  min_land_control_level: z.enum(['freehold', 'leasehold', 'option', 'letter_of_intent', 'any']).default('option'),
  reject_permit_appeal_risk: z.boolean().default(false),

  // Commercial gates
  require_anchor_tenant_loi: z.boolean().default(false),
  min_pre_lease_percent: z.number().min(0).max(100).default(0),
  require_signed_contract: z.boolean().default(false),

  // Technical gates
  min_tier_level: z.enum(['tier_1', 'tier_2', 'tier_3', 'tier_4', 'any']).default('any'),
  max_pue: z.number().nullable().default(null),

  // ESG gates
  require_heat_reuse_plan: z.boolean().default(false),
  require_renewable_commitment: z.boolean().default(false),
  min_renewable_percent: z.number().min(0).max(100).default(0),

  // Timeline gates
  max_energization_months: z.number().nullable().default(null),
});

// ════════════════════════════════════════════════════════════════════════════
// MODULE WEIGHTS - Scoring Prioritization
// ════════════════════════════════════════════════════════════════════════════

export const ModuleWeights = z.object({
  power_grid: z.number().min(0).max(100).default(30),
  permitting_land: z.number().min(0).max(100).default(20),
  technical: z.number().min(0).max(100).default(15),
  commercial: z.number().min(0).max(100).default(20),
  connectivity: z.number().min(0).max(100).default(5),
  esg: z.number().min(0).max(100).default(10),
}).refine(
  (weights) => {
    const total = weights.power_grid + weights.permitting_land + weights.technical +
                  weights.commercial + weights.connectivity + weights.esg;
    return total === 100;
  },
  { message: 'Module weights must sum to 100' }
);

// ════════════════════════════════════════════════════════════════════════════
// TOLERANCES - Acceptable Ranges
// ════════════════════════════════════════════════════════════════════════════

export const Tolerances = z.object({
  // Power tolerances
  capacity_tolerance_percent: z.number().min(0).max(50).default(10),
  firmness_discount_non_firm: z.number().min(0).max(100).default(20),
  firmness_discount_flex: z.number().min(0).max(100).default(10),

  // Timeline tolerances
  energization_delay_tolerance_months: z.number().min(0).default(6),
  permit_expiry_buffer_months: z.number().min(0).default(12),

  // Commercial tolerances
  pricing_variance_from_market_percent: z.number().min(0).max(50).default(15),

  // Technical tolerances
  pue_tolerance: z.number().min(0).max(0.5).default(0.1),
});

// ════════════════════════════════════════════════════════════════════════════
// REQUIRED EVIDENCE - Minimum Documentation Standards
// ════════════════════════════════════════════════════════════════════════════

export const RequiredEvidence = z.object({
  // Power evidence
  power_evidence_level: z.enum(['any', 'letter', 'offer', 'agreement', 'binding_agreement']).default('offer'),
  require_deposit_proof: z.boolean().default(false),
  require_technical_study: z.boolean().default(false),

  // Land evidence
  land_evidence_level: z.enum(['any', 'loi', 'option_agreement', 'lease_heads', 'signed_lease']).default('option_agreement'),

  // Commercial evidence
  commercial_evidence_level: z.enum(['any', 'pipeline', 'loi', 'term_sheet', 'signed_contract']).default('any'),

  // Permit evidence
  permit_evidence_level: z.enum(['any', 'pre_application', 'submitted', 'approved']).default('any'),
});

// ════════════════════════════════════════════════════════════════════════════
// DEAL TYPE PREFERENCES
// ════════════════════════════════════════════════════════════════════════════

export const DealTypePreferences = z.object({
  // Deal types
  accept_greenfield: z.boolean().default(true),
  accept_brownfield: z.boolean().default(true),
  accept_expansion: z.boolean().default(true),
  accept_acquisition: z.boolean().default(true),

  // Product types
  preferred_product_types: z.array(z.enum([
    'hyperscale',
    'enterprise',
    'colocation',
    'edge',
    'hpc',
    'any'
  ])).default(['any']),

  // Geography
  target_countries: z.array(z.string()).default([]),
  excluded_countries: z.array(z.string()).default([]),
  target_cities: z.array(z.string()).default([]),
});

// ════════════════════════════════════════════════════════════════════════════
// SCORING ADJUSTMENTS
// ════════════════════════════════════════════════════════════════════════════

export const ScoringAdjustments = z.object({
  // Bonus points
  bonus_firm_power: z.number().min(0).max(20).default(10),
  bonus_anchor_tenant_signed: z.number().min(0).max(20).default(15),
  bonus_all_permits_granted: z.number().min(0).max(20).default(10),
  bonus_renewable_100: z.number().min(0).max(20).default(5),
  bonus_heat_reuse_plan: z.number().min(0).max(10).default(5),

  // Penalty points
  penalty_non_firm_power: z.number().min(0).max(30).default(15),
  penalty_permit_appeal_risk: z.number().min(0).max(20).default(10),
  penalty_deep_works_required: z.number().min(0).max(20).default(10),
  penalty_queue_position_high: z.number().min(0).max(15).default(5),
  penalty_no_customer_traction: z.number().min(0).max(20).default(10),

  // Red flag escalation
  contradiction_penalty: z.number().min(0).max(30).default(20),
  missing_critical_evidence_penalty: z.number().min(0).max(30).default(15),
});

// ════════════════════════════════════════════════════════════════════════════
// COMPLETE FUND POLICY
// ════════════════════════════════════════════════════════════════════════════

export const FundPolicy = z.object({
  // Metadata
  policy_name: z.string().default('Default Investment Policy'),
  policy_version: z.string().default('1.0'),
  effective_date: z.string().nullable().default(null),

  // Core policy sections
  hard_gates: HardGates.default({}),
  module_weights: ModuleWeights.default({
    power_grid: 30,
    permitting_land: 20,
    technical: 15,
    commercial: 20,
    connectivity: 5,
    esg: 10,
  }),
  tolerances: Tolerances.default({}),
  required_evidence: RequiredEvidence.default({}),
  deal_type_preferences: DealTypePreferences.default({}),
  scoring_adjustments: ScoringAdjustments.default({}),

  // Custom rules (JSON for flexibility)
  custom_rules: z.array(z.object({
    name: z.string(),
    description: z.string(),
    condition: z.string(),
    action: z.enum(['reject', 'flag', 'bonus', 'penalty']),
    value: z.number().nullable(),
  })).default([]),
});

// ════════════════════════════════════════════════════════════════════════════
// PRESET POLICIES
// ════════════════════════════════════════════════════════════════════════════

export const PRESET_POLICIES = {
  // Conservative infrastructure fund
  conservative: FundPolicy.parse({
    policy_name: 'Conservative Infrastructure',
    hard_gates: {
      min_power_title_level: 4,
      require_grid_connection_agreement: true,
      accept_non_firm_connection: false,
      accept_flex_connection: true,
      accept_interruptible_connection: false,
      require_building_permit_granted: true,
      require_land_control: true,
      min_land_control_level: 'leasehold',
      require_anchor_tenant_loi: true,
      min_pre_lease_percent: 30,
    },
    module_weights: {
      power_grid: 35,
      permitting_land: 25,
      technical: 10,
      commercial: 20,
      connectivity: 5,
      esg: 5,
    },
    required_evidence: {
      power_evidence_level: 'binding_agreement',
      require_deposit_proof: true,
      land_evidence_level: 'signed_lease',
      commercial_evidence_level: 'loi',
    },
    scoring_adjustments: {
      bonus_firm_power: 15,
      penalty_non_firm_power: 25,
      penalty_no_customer_traction: 20,
    },
  }),

  // Growth-oriented fund (accepts more risk)
  growth: FundPolicy.parse({
    policy_name: 'Growth-Oriented',
    hard_gates: {
      min_power_title_level: 2,
      require_grid_connection_agreement: false,
      accept_non_firm_connection: true,
      accept_flex_connection: true,
      accept_interruptible_connection: true,
      require_building_permit_granted: false,
      require_land_control: true,
      min_land_control_level: 'option',
    },
    module_weights: {
      power_grid: 25,
      permitting_land: 15,
      technical: 15,
      commercial: 30,
      connectivity: 5,
      esg: 10,
    },
    required_evidence: {
      power_evidence_level: 'offer',
      land_evidence_level: 'option_agreement',
      commercial_evidence_level: 'pipeline',
    },
    scoring_adjustments: {
      bonus_anchor_tenant_signed: 20,
      penalty_non_firm_power: 10,
    },
  }),

  // ESG-focused fund
  esg_focused: FundPolicy.parse({
    policy_name: 'ESG-Focused',
    hard_gates: {
      min_power_title_level: 3,
      accept_non_firm_connection: true,
      require_heat_reuse_plan: true,
      require_renewable_commitment: true,
      min_renewable_percent: 80,
      max_pue: 1.4,
    },
    module_weights: {
      power_grid: 20,
      permitting_land: 15,
      technical: 20,
      commercial: 15,
      connectivity: 5,
      esg: 25,
    },
    required_evidence: {
      power_evidence_level: 'offer',
    },
    scoring_adjustments: {
      bonus_renewable_100: 15,
      bonus_heat_reuse_plan: 10,
    },
  }),

  // Hyperscale-focused fund
  hyperscale: FundPolicy.parse({
    policy_name: 'Hyperscale Focus',
    hard_gates: {
      min_power_title_level: 3,
      accept_non_firm_connection: true,
      accept_flex_connection: true,
      max_curtailment_percent: 5,
    },
    module_weights: {
      power_grid: 40,
      permitting_land: 15,
      technical: 15,
      commercial: 15,
      connectivity: 10,
      esg: 5,
    },
    deal_type_preferences: {
      preferred_product_types: ['hyperscale'],
      accept_greenfield: true,
      accept_brownfield: true,
    },
    required_evidence: {
      power_evidence_level: 'agreement',
      require_technical_study: true,
    },
    scoring_adjustments: {
      bonus_firm_power: 15,
      penalty_deep_works_required: 15,
    },
  }),
};

// ════════════════════════════════════════════════════════════════════════════
// POLICY EVALUATION FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

export type FundPolicyType = z.infer<typeof FundPolicy>;
export type HardGatesType = z.infer<typeof HardGates>;
export type ModuleWeightsType = z.infer<typeof ModuleWeights>;

export interface HardGateResult {
  gate: string;
  passed: boolean;
  reason: string;
  actual_value: string | number | boolean | null;
  required_value: string | number | boolean | null;
}

export interface PolicyEvaluationResult {
  passes_hard_gates: boolean;
  hard_gate_results: HardGateResult[];
  failed_gates: string[];
  weighted_score: number;
  score_adjustments: Array<{ name: string; points: number; reason: string }>;
  recommendation: 'PROCEED' | 'REVIEW' | 'REJECT';
  recommendation_reason: string;
}

/**
 * Evaluate if a deal passes all hard gates
 */
export function evaluateHardGates(
  gates: HardGatesType,
  dealFacts: Record<string, any>
): HardGateResult[] {
  const results: HardGateResult[] = [];

  // Power title level
  if (gates.min_power_title_level > 0) {
    const actual = dealFacts.power_title_level ?? 0;
    results.push({
      gate: 'min_power_title_level',
      passed: actual >= gates.min_power_title_level,
      reason: `Power title level must be at least ${gates.min_power_title_level}`,
      actual_value: actual,
      required_value: gates.min_power_title_level,
    });
  }

  // Firmness requirements
  if (!gates.accept_non_firm_connection) {
    const firmness = dealFacts.firmness_type ?? 'unknown';
    results.push({
      gate: 'accept_non_firm_connection',
      passed: firmness === 'firm',
      reason: 'Non-firm connections not accepted',
      actual_value: firmness,
      required_value: 'firm',
    });
  }

  // Land control
  if (gates.require_land_control) {
    const landControl = dealFacts.land_control_type ?? 'none';
    const levels = ['freehold', 'leasehold', 'option', 'letter_of_intent'];
    const minIndex = levels.indexOf(gates.min_land_control_level);
    const actualIndex = levels.indexOf(landControl);
    results.push({
      gate: 'min_land_control_level',
      passed: actualIndex !== -1 && actualIndex <= minIndex,
      reason: `Land control must be at least ${gates.min_land_control_level}`,
      actual_value: landControl,
      required_value: gates.min_land_control_level,
    });
  }

  // Add more gate evaluations as needed...

  return results;
}

/**
 * Calculate weighted score based on module weights
 */
export function calculateWeightedScore(
  weights: ModuleWeightsType,
  moduleScores: Record<string, number>
): number {
  let totalScore = 0;
  let totalWeight = 0;

  const modules = ['power_grid', 'permitting_land', 'technical', 'commercial', 'connectivity', 'esg'] as const;

  for (const modKey of modules) {
    const weight = weights[modKey];
    const score = moduleScores[modKey] ?? 0;
    totalScore += (weight / 100) * score;
    totalWeight += weight;
  }

  return Math.round(totalScore);
}

/**
 * Get policy recommendation based on evaluation
 */
export function getRecommendation(
  hardGatesPassed: boolean,
  weightedScore: number,
  redFlagCount: number
): { recommendation: 'PROCEED' | 'REVIEW' | 'REJECT'; reason: string } {
  if (!hardGatesPassed) {
    return { recommendation: 'REJECT', reason: 'Failed one or more hard gates' };
  }

  if (redFlagCount >= 3) {
    return { recommendation: 'REJECT', reason: 'Too many red flags identified' };
  }

  if (weightedScore >= 70 && redFlagCount === 0) {
    return { recommendation: 'PROCEED', reason: 'Strong score with no red flags' };
  }

  if (weightedScore >= 50) {
    return { recommendation: 'REVIEW', reason: 'Moderate score - requires further review' };
  }

  return { recommendation: 'REJECT', reason: 'Score too low' };
}
