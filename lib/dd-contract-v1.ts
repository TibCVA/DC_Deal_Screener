/**
 * DD Contract v1 - Machine-readable Due Diligence Specification
 *
 * Principles (non-negotiables):
 * 1. Deal evidence vs Market context separation
 * 2. Citation integrity (value != null => citations.length >= 1)
 * 3. Determinism (fixed queries, capped snippets, temperature=0)
 * 4. Versioning (contract_version + fund_policy_snapshot)
 */

import { z } from 'zod';

// ════════════════════════════════════════════════════════════════════════════
// CONTRACT VERSION
// ════════════════════════════════════════════════════════════════════════════

export const CONTRACT_VERSION = 'dd.v1' as const;

// ════════════════════════════════════════════════════════════════════════════
// ENUMS
// ════════════════════════════════════════════════════════════════════════════

export const DDModuleSchema = z.enum([
  'POWER_GRID',
  'PERMITS_LAND',
  'COMMERCIAL',
  'CONNECTIVITY',
  'TECH_BUILD',
  'ESG_REGULATORY',
  'SPONSOR_EXECUTION',
]);
export type DDModule = z.infer<typeof DDModuleSchema>;

// V1 focuses on core 4 modules
export const DDModuleV1Schema = z.enum([
  'POWER_GRID',
  'PERMITS_LAND',
  'COMMERCIAL',
  'CONNECTIVITY',
]);
export type DDModuleV1 = z.infer<typeof DDModuleV1Schema>;

export const EvidenceTierSchema = z.enum([
  'NONE',
  'SELLER_STATEMENT',
  'THIRD_PARTY',
  'OFFICIAL_UNSIGNED',
  'OFFICIAL_SIGNED',
  'OFFICIAL_SIGNED_AND_PAID',
  'OPERATING_MEASUREMENT',
]);
export type EvidenceTier = z.infer<typeof EvidenceTierSchema>;

export const HardGateDecisionSchema = z.enum(['GO', 'HOLD', 'NO_GO']);
export type HardGateDecision = z.infer<typeof HardGateDecisionSchema>;

export const ModuleStatusSchema = z.enum(['VERIFIED', 'PARTIAL', 'UNKNOWN']);
export type ModuleStatus = z.infer<typeof ModuleStatusSchema>;

export const SeveritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type Severity = z.infer<typeof SeveritySchema>;

export const PrioritySchema = z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
export type Priority = z.infer<typeof PrioritySchema>;

export const DealTypeSchema = z.enum(['GREENFIELD', 'BROWNFIELD', 'EXPANSION', 'ACQUISITION']);
export type DealType = z.infer<typeof DealTypeSchema>;

export const ProductTypeSchema = z.enum([
  'Hyperscale',
  'Colocation',
  'Edge',
  'Build-to-suit',
  'Other',
]);
export type ProductType = z.infer<typeof ProductTypeSchema>;

export const RunStatusSchema = z.enum(['SUCCESS', 'FAILED', 'PARTIAL']);
export type RunStatus = z.infer<typeof RunStatusSchema>;

// ════════════════════════════════════════════════════════════════════════════
// ARTIFACT TYPES (generic, EU-portable)
// ════════════════════════════════════════════════════════════════════════════

export const ArtifactTypeSchema = z.enum([
  // Grid
  'GRID_ENQUIRY_OR_FEASIBILITY_REPLY',
  'GRID_APPLICATION_SUBMITTED',
  'GRID_CONNECTION_OFFER_TECHNICAL_FINANCIAL',
  'GRID_CONNECTION_AGREEMENT_SIGNED',
  'GRID_DEPOSIT_PAYMENT_PROOF',
  'GRID_QUEUE_POSITION_CONFIRMATION',
  'GRID_FIRMNESS_FLEX_TERMS_ANNEX',
  'GRID_CURTAILMENT_TERMS',
  'GRID_DEEP_WORKS_SCOPE',
  // Planning/Land
  'PLANNING_APPLICATION_SUBMITTED',
  'PLANNING_PERMISSION_GRANTED',
  'PLANNING_PERMISSION_FINAL_OR_IN_FORCE',
  'ENVIRONMENTAL_PERMIT',
  'BUILDING_PERMIT',
  'LAND_TITLE_OWNERSHIP',
  'LAND_LEASE',
  'LAND_OPTION',
  'LAND_CONTROL_EXPIRY_EVIDENCE',
  'CABLE_ROUTE_WAYLEAVE_OR_EASEMENT',
  // Connectivity
  'FIBER_AVAILABILITY_LETTER',
  'CARRIER_QUOTE_OR_CONTRACT',
  'DIVERSE_ROUTE_CONFIRMATION',
  // Commercial
  'CUSTOMER_LOI',
  'CUSTOMER_CONTRACT_MSA_OR_LEASE',
  // ESG
  'HEAT_REUSE_REQUIREMENT_EVIDENCE',
  'HEAT_OFFTAKE_AGREEMENT',
  'WATER_RIGHTS_OR_SUPPLY_EVIDENCE',
  // Execution
  'EPC_OR_CONTRACTOR_APPOINTMENT',
  'OPERATOR_APPOINTMENT',
  'CAPEX_ESTIMATE_OR_BUDGET',
]);
export type ArtifactType = z.infer<typeof ArtifactTypeSchema>;

// ════════════════════════════════════════════════════════════════════════════
// STAGE SCALES (standardized for underwriting comparability)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Grid Title Level (0-5)
 * 0: no grid evidence
 * 1: enquiry / feasibility email only
 * 2: formal application submitted (proof of submission)
 * 3: official offer received (technical/financial) but not executed
 * 4: executed/signed agreement (offer accepted / contract signed)
 * 5: signed + payment proof (deposit) or works formally initiated
 */
export const GridTitleLevelSchema = z.number().int().min(0).max(5);
export type GridTitleLevel = z.infer<typeof GridTitleLevelSchema>;

/**
 * Land Control Level (0-4)
 * 0: none
 * 1: soft exclusivity / draft heads
 * 2: option signed / conditional lease
 * 3: lease signed (or equivalent binding control)
 * 4: ownership/title acquired
 */
export const LandControlLevelSchema = z.number().int().min(0).max(4);
export type LandControlLevel = z.infer<typeof LandControlLevelSchema>;

/**
 * Planning Level (0-5)
 * 0: none
 * 1: pre-app / concept stage evidence
 * 2: application submitted (proof)
 * 3: granted but not yet final (appeal window / conditions open)
 * 4: final / in force
 * 5: key conditions discharged (if applicable and evidenced)
 */
export const PlanningLevelSchema = z.number().int().min(0).max(5);
export type PlanningLevel = z.infer<typeof PlanningLevelSchema>;

/**
 * Commercial Title Level (0-4)
 * 0: none
 * 1: pipeline claims only
 * 2: LOI / term sheet
 * 3: signed contract (MSA/lease) conditional
 * 4: signed + binding (or revenue visibility) evidenced
 */
export const CommercialTitleLevelSchema = z.number().int().min(0).max(4);
export type CommercialTitleLevel = z.infer<typeof CommercialTitleLevelSchema>;

/**
 * Connectivity Title Level (0-4)
 * 0: none
 * 1: fiber presence assumed (market claims)
 * 2: availability letter received
 * 3: carrier quote/contract received
 * 4: diverse routes confirmed + contracted
 */
export const ConnectivityTitleLevelSchema = z.number().int().min(0).max(4);
export type ConnectivityTitleLevel = z.infer<typeof ConnectivityTitleLevelSchema>;

// ════════════════════════════════════════════════════════════════════════════
// EVIDENCE SNIPPETS
// ════════════════════════════════════════════════════════════════════════════

export const EvidenceSnippetSchema = z.object({
  snippet_id: z.string(),
  text: z.string(),
  source: z.object({
    deal_document_id: z.string().nullable(),
    file_name: z.string().nullable(),
  }),
  retrieval: z.object({
    query: z.string(),
    score: z.number().nullable(),
  }),
  openai: z.object({
    vector_store_id: z.string().nullable(),
    file_id: z.string().nullable(),
  }),
  metadata: z.record(z.any()).nullable(),
});
export type EvidenceSnippet = z.infer<typeof EvidenceSnippetSchema>;

// ════════════════════════════════════════════════════════════════════════════
// FACTS
// ════════════════════════════════════════════════════════════════════════════

export const FactCandidateSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean()]),
  citations: z.array(z.string()),
});
export type FactCandidate = z.infer<typeof FactCandidateSchema>;

export const FactValueSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean()]).nullable(),
  unit: z.string().nullable(),
  citations: z.array(z.string()),
  evidence_tier: EvidenceTierSchema,
  source_artifact_types: z.array(ArtifactTypeSchema),
  notes: z.string().nullable(),
  candidates: z.array(FactCandidateSchema).optional(),
});
export type FactValue = z.infer<typeof FactValueSchema>;

// ════════════════════════════════════════════════════════════════════════════
// ARTIFACT REGISTER
// ════════════════════════════════════════════════════════════════════════════

export const ArtifactRegisterEntrySchema = z.object({
  artifact_type: ArtifactTypeSchema,
  evidence_tier: EvidenceTierSchema,
  issuer: z.string().nullable(),
  date: z.string().nullable(),
  key_fields: z.record(z.any()),
  citations: z.array(z.string()),
});
export type ArtifactRegisterEntry = z.infer<typeof ArtifactRegisterEntrySchema>;

// ════════════════════════════════════════════════════════════════════════════
// CONTRADICTIONS
// ════════════════════════════════════════════════════════════════════════════

export const ContradictionSchema = z.object({
  fact_code: z.string(),
  severity: SeveritySchema,
  description: z.string(),
  conflicting_candidates: z.array(FactCandidateSchema),
});
export type Contradiction = z.infer<typeof ContradictionSchema>;

// ════════════════════════════════════════════════════════════════════════════
// DEAL EVIDENCE (complete section)
// ════════════════════════════════════════════════════════════════════════════

export const DealEvidenceSchema = z.object({
  evidence_snippets: z.array(EvidenceSnippetSchema),
  facts: z.record(z.string(), FactValueSchema),
  artifact_register: z.array(ArtifactRegisterEntrySchema),
  contradictions: z.array(ContradictionSchema),
});
export type DealEvidence = z.infer<typeof DealEvidenceSchema>;

// ════════════════════════════════════════════════════════════════════════════
// FUND POLICY SNAPSHOT
// ════════════════════════════════════════════════════════════════════════════

export const HardGatesSchema = z.object({
  min_power_title_level: GridTitleLevelSchema.default(0),
  min_land_control_level: LandControlLevelSchema.default(0),
  min_planning_level: PlanningLevelSchema.default(0),
  requires_anchor_customer: z.boolean().default(false),
  accepts_non_firm_power: z.boolean().default(true),
  max_curtailment_cap_hours_per_year: z.number().nullable().default(null),
  max_flex_share_pct: z.number().nullable().default(null),
});
export type HardGates = z.infer<typeof HardGatesSchema>;

export const ModuleWeightsSchema = z.object({
  POWER_GRID: z.number().default(0.3),
  PERMITS_LAND: z.number().default(0.2),
  COMMERCIAL: z.number().default(0.2),
  CONNECTIVITY: z.number().default(0.1),
  TECH_BUILD: z.number().default(0.1),
  ESG_REGULATORY: z.number().default(0.1),
});
export type ModuleWeights = z.infer<typeof ModuleWeightsSchema>;

export const DealFocusSchema = z.object({
  preferred_deal_types: z.array(DealTypeSchema).default(['GREENFIELD', 'BROWNFIELD']),
  preferred_product_types: z.array(ProductTypeSchema).default([
    'Hyperscale',
    'Colocation',
    'Edge',
    'Build-to-suit',
    'Other',
  ]),
});
export type DealFocus = z.infer<typeof DealFocusSchema>;

export const FundPolicySnapshotSchema = z.object({
  policy_version: z.string(),
  deal_focus: DealFocusSchema,
  hard_gates: HardGatesSchema,
  weights: ModuleWeightsSchema,
});
export type FundPolicySnapshot = z.infer<typeof FundPolicySnapshotSchema>;

// ════════════════════════════════════════════════════════════════════════════
// SCORING
// ════════════════════════════════════════════════════════════════════════════

export const HardGateResultSchema = z.object({
  decision: HardGateDecisionSchema,
  reasons: z.array(z.string()),
  gating_citations: z.array(z.string()),
});
export type HardGateResult = z.infer<typeof HardGateResultSchema>;

export const ModuleScorecardEntrySchema = z.object({
  module: DDModuleSchema,
  status: ModuleStatusSchema,
  score_0_100: z.number().min(0).max(100),
  rationale: z.string(),
  citations: z.array(z.string()),
});
export type ModuleScorecardEntry = z.infer<typeof ModuleScorecardEntrySchema>;

export const OverallScoreSchema = z.object({
  status: ModuleStatusSchema,
  score_0_100: z.number().min(0).max(100),
  executive_summary: z.string(),
});
export type OverallScore = z.infer<typeof OverallScoreSchema>;

export const EnergisationInputsSchema = z.object({
  power_title_level: GridTitleLevelSchema.nullable(),
  permit_level: PlanningLevelSchema.nullable(),
  land_control_level: LandControlLevelSchema.nullable(),
  firm_reserved_mw: z.number().nullable(),
  flex_reserved_mw: z.number().nullable(),
  deep_works_flag: z.boolean().nullable(),
  next_kill_date: z.string().nullable(),
});
export type EnergisationInputs = z.infer<typeof EnergisationInputsSchema>;

export const EnergisationCurvePointSchema = z.object({
  horizon_months: z.number(),
  p: z.number().min(0).max(1),
});
export type EnergisationCurvePoint = z.infer<typeof EnergisationCurvePointSchema>;

export const EnergisationSchema = z.object({
  method: z.literal('HEURISTIC_READINESS_INDEX'),
  inputs: EnergisationInputsSchema,
  curve: z.array(EnergisationCurvePointSchema),
  explanation: z.string(),
});
export type Energisation = z.infer<typeof EnergisationSchema>;

export const ScoringSchema = z.object({
  hard_gate_result: HardGateResultSchema,
  module_scorecard: z.array(ModuleScorecardEntrySchema),
  overall: OverallScoreSchema,
  energisation: EnergisationSchema,
});
export type Scoring = z.infer<typeof ScoringSchema>;

// ════════════════════════════════════════════════════════════════════════════
// UNDERWRITING TAPE
// ════════════════════════════════════════════════════════════════════════════

export const UnderwritingTapeVariableSchema = z.object({
  variable_code: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]).nullable(),
  status: ModuleStatusSchema,
  citations: z.array(z.string()),
  requested_artifact_types: z.array(ArtifactTypeSchema),
});
export type UnderwritingTapeVariable = z.infer<typeof UnderwritingTapeVariableSchema>;

// The 10 standard underwriting tape variables
export const UNDERWRITING_TAPE_VARIABLES = [
  'grid_title_level_0_5',
  'grid_reserved_mw_firm',
  'grid_reserved_mw_flex',
  'grid_curtailment_cap',
  'grid_energisation_target',
  'grid_next_milestone_or_expiry_date',
  'land_control_level_0_4',
  'planning_permission_level_0_5',
  'grid_deep_works_flag',
  'commercial_title_level_0_4',
] as const;

export type UnderwritingTapeVariableCode = (typeof UNDERWRITING_TAPE_VARIABLES)[number];

// ════════════════════════════════════════════════════════════════════════════
// CHECKLIST
// ════════════════════════════════════════════════════════════════════════════

export const ChecklistItemSchema = z.object({
  priority: PrioritySchema,
  module: DDModuleSchema,
  question: z.string(),
  why: z.string(),
  requested_artifact_types: z.array(ArtifactTypeSchema),
  gating: z.boolean(),
  citations: z.array(z.string()),
});
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

// ════════════════════════════════════════════════════════════════════════════
// MARKET CONTEXT
// ════════════════════════════════════════════════════════════════════════════

export const MarketContextStatusSchema = z.enum(['COMPLETED', 'SKIPPED', 'FAILED']);

export const MarketContextSchema = z.object({
  included: z.boolean(),
  status: MarketContextStatusSchema.nullable(),
  summary: z.string().nullable(),
  sources: z.array(z.string()),
  citations: z.array(z.string()),
  disclaimer: z.string(),
});
export type MarketContext = z.infer<typeof MarketContextSchema>;

// ════════════════════════════════════════════════════════════════════════════
// RUN META
// ════════════════════════════════════════════════════════════════════════════

export const RunMetaSchema = z.object({
  deal_id: z.string(),
  organization_id: z.string(),
  fund_id: z.string(),
  created_at: z.string(),
  model_used: z.string(),
  reasoning_effort: z.string().nullable(),
  status: RunStatusSchema,
  error_message: z.string().nullable(),
});
export type RunMeta = z.infer<typeof RunMetaSchema>;

// ════════════════════════════════════════════════════════════════════════════
// DEAL SNAPSHOT
// ════════════════════════════════════════════════════════════════════════════

export const DealSnapshotSchema = z.object({
  name: z.string(),
  country_code: z.string(),
  city: z.string(),
  deal_type: DealTypeSchema,
  product_type: z.string(),
});
export type DealSnapshot = z.infer<typeof DealSnapshotSchema>;

// ════════════════════════════════════════════════════════════════════════════
// COMPLETE DD CONTRACT V1 OUTPUT
// ════════════════════════════════════════════════════════════════════════════

export const DDContractV1Schema = z.object({
  contract_version: z.literal('dd.v1'),
  run_meta: RunMetaSchema,
  fund_policy_snapshot: FundPolicySnapshotSchema,
  deal_snapshot: DealSnapshotSchema,
  deal_evidence: DealEvidenceSchema,
  scoring: ScoringSchema,
  underwriting_tape: z.array(UnderwritingTapeVariableSchema),
  checklist: z.array(ChecklistItemSchema),
  market_context: MarketContextSchema,
});
export type DDContractV1 = z.infer<typeof DDContractV1Schema>;

// ════════════════════════════════════════════════════════════════════════════
// COUNTRY PACK CONTRACT V1
// ════════════════════════════════════════════════════════════════════════════

export const GoldSourceTypeSchema = z.enum([
  'TSO_REGISTER',
  'DSO_MAP',
  'REGULATOR_DECISION',
  'API',
  'LAW',
  'CONSULTATION',
  'OTHER',
]);

export const GoldSourceSchema = z.object({
  name: z.string(),
  type: GoldSourceTypeSchema,
  url: z.string(),
  notes: z.string().nullable(),
});
export type GoldSource = z.infer<typeof GoldSourceSchema>;

export const IssuerTypeSchema = z.enum(['TSO', 'DSO', 'REGULATOR', 'MUNICIPALITY', 'OTHER']);

export const ArtefactMapEntrySchema = z.object({
  artifact_type: ArtifactTypeSchema,
  local_name: z.string(),
  issuer_types: z.array(IssuerTypeSchema),
  minimum_required_fields: z.array(z.string()),
  evidence_tier_if_present: EvidenceTierSchema,
});
export type ArtefactMapEntry = z.infer<typeof ArtefactMapEntrySchema>;

export const QueueRuleAppliesToSchema = z.enum(['LARGE_LOADS', 'DATA_CENTERS', 'ALL']);

export const QueueRuleSchema = z.object({
  rule_name: z.string(),
  applies_to: QueueRuleAppliesToSchema,
  summary: z.string(),
  proof_required: z.array(ArtifactTypeSchema),
  official_reference_urls: z.array(z.string()),
});
export type QueueRule = z.infer<typeof QueueRuleSchema>;

export const CountryPackContractV1Schema = z.object({
  country_code: z.string(),
  official_allowed_domains: z.array(z.string()),
  gold_sources: z.array(GoldSourceSchema),
  artefact_map: z.array(ArtefactMapEntrySchema),
  queue_rules: z.array(QueueRuleSchema),
});
export type CountryPackContractV1 = z.infer<typeof CountryPackContractV1Schema>;

// ════════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════════

export const MARKET_CONTEXT_DISCLAIMER =
  'Market context is derived from official sources only and does not constitute deal evidence. ' +
  'It provides regulatory background and should not be used to verify deal-specific claims.';

/**
 * Create an empty fact value (no evidence)
 */
export function createEmptyFactValue(): FactValue {
  return {
    value: null,
    unit: null,
    citations: [],
    evidence_tier: 'NONE',
    source_artifact_types: [],
    notes: null,
  };
}

/**
 * Create default fund policy (conservative)
 */
export function createDefaultFundPolicy(): FundPolicySnapshot {
  return {
    policy_version: 'default.v1',
    deal_focus: {
      preferred_deal_types: ['GREENFIELD', 'BROWNFIELD'],
      preferred_product_types: ['Hyperscale', 'Colocation', 'Edge', 'Build-to-suit', 'Other'],
    },
    hard_gates: {
      min_power_title_level: 2,
      min_land_control_level: 2,
      min_planning_level: 2,
      requires_anchor_customer: false,
      accepts_non_firm_power: true,
      max_curtailment_cap_hours_per_year: null,
      max_flex_share_pct: null,
    },
    weights: {
      POWER_GRID: 0.3,
      PERMITS_LAND: 0.2,
      COMMERCIAL: 0.2,
      CONNECTIVITY: 0.1,
      TECH_BUILD: 0.1,
      ESG_REGULATORY: 0.1,
    },
  };
}
