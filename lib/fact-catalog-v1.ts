/**
 * Fact Catalog v1 - 4 Core Modules
 *
 * Modules included in v1:
 * - POWER_GRID: Grid connection, capacity, firmness
 * - PERMITS_LAND: Land control, planning permissions
 * - COMMERCIAL: Customer traction, prelet status
 * - CONNECTIVITY: Fiber, carriers, diverse routes
 *
 * Each fact has:
 * - code: unique identifier
 * - type: value type (string | number | boolean)
 * - unit: optional unit (MW, kV, etc.)
 * - hard_gate: whether this fact affects GO/HOLD/NO_GO decision
 * - expected_artifacts: artifact types that should evidence this fact
 * - retrieval_queries: queries to use for vector store search
 */

import { type ArtifactType, type DDModuleV1 } from './dd-contract-v1';

// ════════════════════════════════════════════════════════════════════════════
// FACT DEFINITION TYPE
// ════════════════════════════════════════════════════════════════════════════

export interface FactDefinition {
  code: string;
  module: DDModuleV1;
  label: string;
  type: 'string' | 'number' | 'boolean';
  unit: string | null;
  hard_gate: boolean;
  expected_artifacts: ArtifactType[];
  retrieval_queries: string[];
}

// ════════════════════════════════════════════════════════════════════════════
// POWER_GRID MODULE FACTS
// ════════════════════════════════════════════════════════════════════════════

export const POWER_GRID_FACTS: FactDefinition[] = [
  {
    code: 'grid_target_import_mw',
    module: 'POWER_GRID',
    label: 'Target Import (MW)',
    type: 'number',
    unit: 'MW',
    hard_gate: false,
    expected_artifacts: ['CAPEX_ESTIMATE_OR_BUDGET', 'GRID_CONNECTION_OFFER_TECHNICAL_FINANCIAL'],
    retrieval_queries: [
      'target import MW capacity power requirement',
      'total site load demand megawatts',
    ],
  },
  {
    code: 'grid_reserved_mw_firm',
    module: 'POWER_GRID',
    label: 'Reserved Firm MW',
    type: 'number',
    unit: 'MW',
    hard_gate: true,
    expected_artifacts: [
      'GRID_CONNECTION_AGREEMENT_SIGNED',
      'GRID_CONNECTION_OFFER_TECHNICAL_FINANCIAL',
      'GRID_DEPOSIT_PAYMENT_PROOF',
    ],
    retrieval_queries: [
      'firm capacity reserved MW megawatts connection',
      'guaranteed power capacity allocation',
      'reserved firm capacity connection agreement',
    ],
  },
  {
    code: 'grid_reserved_mw_flex',
    module: 'POWER_GRID',
    label: 'Reserved Flex MW',
    type: 'number',
    unit: 'MW',
    hard_gate: false,
    expected_artifacts: ['GRID_FIRMNESS_FLEX_TERMS_ANNEX', 'GRID_CURTAILMENT_TERMS'],
    retrieval_queries: [
      'flex non-firm capacity MW interruptible',
      'curtailable capacity allocation',
      'flexible power arrangement terms',
    ],
  },
  {
    code: 'grid_connection_voltage_kv',
    module: 'POWER_GRID',
    label: 'Connection Voltage (kV)',
    type: 'number',
    unit: 'kV',
    hard_gate: false,
    expected_artifacts: [
      'GRID_CONNECTION_OFFER_TECHNICAL_FINANCIAL',
      'GRID_CONNECTION_AGREEMENT_SIGNED',
    ],
    retrieval_queries: [
      'voltage kV connection point level',
      'high voltage medium voltage connection',
      'substation voltage level kilovolts',
    ],
  },
  {
    code: 'grid_connection_point_name',
    module: 'POWER_GRID',
    label: 'Connection Point',
    type: 'string',
    unit: null,
    hard_gate: false,
    expected_artifacts: [
      'GRID_CONNECTION_OFFER_TECHNICAL_FINANCIAL',
      'GRID_CONNECTION_AGREEMENT_SIGNED',
    ],
    retrieval_queries: [
      'connection point substation name location',
      'grid connection point of connection POC',
    ],
  },
  {
    code: 'grid_curtailment_cap',
    module: 'POWER_GRID',
    label: 'Curtailment Cap',
    type: 'string',
    unit: null,
    hard_gate: false,
    expected_artifacts: ['GRID_CURTAILMENT_TERMS', 'GRID_FIRMNESS_FLEX_TERMS_ANNEX'],
    retrieval_queries: [
      'curtailment cap limit hours per year',
      'maximum curtailment interruption limits',
      'load shedding cap restrictions',
    ],
  },
  {
    code: 'grid_energisation_target',
    module: 'POWER_GRID',
    label: 'Energisation Target',
    type: 'string',
    unit: null,
    hard_gate: true,
    expected_artifacts: [
      'GRID_CONNECTION_OFFER_TECHNICAL_FINANCIAL',
      'GRID_CONNECTION_AGREEMENT_SIGNED',
      'GRID_QUEUE_POSITION_CONFIRMATION',
    ],
    retrieval_queries: [
      'energisation date target COD commercial operation',
      'connection date milestone delivery',
      'when power available connection completion',
    ],
  },
  {
    code: 'grid_next_milestone_or_expiry_date',
    module: 'POWER_GRID',
    label: 'Next Milestone/Expiry',
    type: 'string',
    unit: null,
    hard_gate: true,
    expected_artifacts: [
      'GRID_QUEUE_POSITION_CONFIRMATION',
      'GRID_CONNECTION_OFFER_TECHNICAL_FINANCIAL',
      'GRID_CONNECTION_AGREEMENT_SIGNED',
    ],
    retrieval_queries: [
      'queue expiry deadline milestone date',
      'offer validity expiry acceptance deadline',
      'next milestone trigger date condition',
    ],
  },
  {
    code: 'grid_deep_works_flag',
    module: 'POWER_GRID',
    label: 'Deep Works Required',
    type: 'boolean',
    unit: null,
    hard_gate: false,
    expected_artifacts: ['GRID_DEEP_WORKS_SCOPE', 'GRID_CONNECTION_OFFER_TECHNICAL_FINANCIAL'],
    retrieval_queries: [
      'reinforcement works deep works network upgrade',
      'grid infrastructure works required',
      'network reinforcement extension required',
    ],
  },
  {
    code: 'grid_title_level_0_5',
    module: 'POWER_GRID',
    label: 'Grid Title Level (0-5)',
    type: 'number',
    unit: null,
    hard_gate: true,
    expected_artifacts: [
      'GRID_CONNECTION_OFFER_TECHNICAL_FINANCIAL',
      'GRID_CONNECTION_AGREEMENT_SIGNED',
      'GRID_DEPOSIT_PAYMENT_PROOF',
    ],
    retrieval_queries: [
      'grid connection agreement signed executed',
      'connection offer received accepted',
      'grid application submitted enquiry feasibility',
    ],
  },
];

// ════════════════════════════════════════════════════════════════════════════
// PERMITS_LAND MODULE FACTS
// ════════════════════════════════════════════════════════════════════════════

export const PERMITS_LAND_FACTS: FactDefinition[] = [
  {
    code: 'land_control_level_0_4',
    module: 'PERMITS_LAND',
    label: 'Land Control Level (0-4)',
    type: 'number',
    unit: null,
    hard_gate: true,
    expected_artifacts: ['LAND_TITLE_OWNERSHIP', 'LAND_LEASE', 'LAND_OPTION'],
    retrieval_queries: [
      'land ownership title deed freehold',
      'lease agreement signed executed',
      'option agreement land control',
    ],
  },
  {
    code: 'land_control_type',
    module: 'PERMITS_LAND',
    label: 'Land Control Type',
    type: 'string',
    unit: null,
    hard_gate: true,
    expected_artifacts: ['LAND_TITLE_OWNERSHIP', 'LAND_LEASE', 'LAND_OPTION'],
    retrieval_queries: [
      'freehold leasehold option land tenure type',
      'land ownership structure control mechanism',
    ],
  },
  {
    code: 'land_control_expiry_date',
    module: 'PERMITS_LAND',
    label: 'Land Control Expiry',
    type: 'string',
    unit: null,
    hard_gate: false,
    expected_artifacts: ['LAND_CONTROL_EXPIRY_EVIDENCE', 'LAND_OPTION', 'LAND_LEASE'],
    retrieval_queries: [
      'option expiry lease expiry land control deadline',
      'land agreement expiration term end',
    ],
  },
  {
    code: 'planning_permission_level_0_5',
    module: 'PERMITS_LAND',
    label: 'Planning Level (0-5)',
    type: 'number',
    unit: null,
    hard_gate: true,
    expected_artifacts: [
      'PLANNING_APPLICATION_SUBMITTED',
      'PLANNING_PERMISSION_GRANTED',
      'PLANNING_PERMISSION_FINAL_OR_IN_FORCE',
    ],
    retrieval_queries: [
      'planning permission granted approved',
      'planning application submitted pending',
      'building consent zoning approval',
    ],
  },
  {
    code: 'planning_permission_expiry_date',
    module: 'PERMITS_LAND',
    label: 'Planning Expiry',
    type: 'string',
    unit: null,
    hard_gate: false,
    expected_artifacts: ['PLANNING_PERMISSION_GRANTED', 'PLANNING_PERMISSION_FINAL_OR_IN_FORCE'],
    retrieval_queries: [
      'planning permission expiry validity period',
      'consent expiration implementation deadline',
    ],
  },
  {
    code: 'environmental_permit_status',
    module: 'PERMITS_LAND',
    label: 'Environmental Permit',
    type: 'string',
    unit: null,
    hard_gate: false,
    expected_artifacts: ['ENVIRONMENTAL_PERMIT'],
    retrieval_queries: [
      'environmental permit EIA assessment status',
      'environmental approval impact assessment',
    ],
  },
  {
    code: 'building_permit_status',
    module: 'PERMITS_LAND',
    label: 'Building Permit',
    type: 'string',
    unit: null,
    hard_gate: false,
    expected_artifacts: ['BUILDING_PERMIT'],
    retrieval_queries: [
      'building permit construction approval status',
      'building consent construction permit',
    ],
  },
  {
    code: 'cable_route_rights_status',
    module: 'PERMITS_LAND',
    label: 'Cable Route Rights',
    type: 'string',
    unit: null,
    hard_gate: false,
    expected_artifacts: ['CABLE_ROUTE_WAYLEAVE_OR_EASEMENT'],
    retrieval_queries: [
      'cable route wayleave easement rights of way',
      'power cable route access rights servitude',
    ],
  },
];

// ════════════════════════════════════════════════════════════════════════════
// CONNECTIVITY MODULE FACTS
// ════════════════════════════════════════════════════════════════════════════

export const CONNECTIVITY_FACTS: FactDefinition[] = [
  {
    code: 'fiber_presence_confirmed',
    module: 'CONNECTIVITY',
    label: 'Fiber Confirmed',
    type: 'boolean',
    unit: null,
    hard_gate: false,
    expected_artifacts: ['FIBER_AVAILABILITY_LETTER', 'CARRIER_QUOTE_OR_CONTRACT'],
    retrieval_queries: [
      'fiber availability dark fiber connectivity',
      'telecommunications fiber optic access',
    ],
  },
  {
    code: 'carrier_count_confirmed',
    module: 'CONNECTIVITY',
    label: 'Carrier Count',
    type: 'number',
    unit: 'count',
    hard_gate: false,
    expected_artifacts: ['CARRIER_QUOTE_OR_CONTRACT'],
    retrieval_queries: [
      'number of carriers telecoms providers',
      'multiple carrier access connectivity options',
    ],
  },
  {
    code: 'diverse_routes_confirmed',
    module: 'CONNECTIVITY',
    label: 'Diverse Routes',
    type: 'boolean',
    unit: null,
    hard_gate: false,
    expected_artifacts: ['DIVERSE_ROUTE_CONFIRMATION', 'FIBER_AVAILABILITY_LETTER'],
    retrieval_queries: [
      'diverse routes path diversity redundancy',
      'multiple fiber paths geographic diversity',
    ],
  },
  {
    code: 'connectivity_title_level_0_4',
    module: 'CONNECTIVITY',
    label: 'Connectivity Level (0-4)',
    type: 'number',
    unit: null,
    hard_gate: false,
    expected_artifacts: [
      'FIBER_AVAILABILITY_LETTER',
      'CARRIER_QUOTE_OR_CONTRACT',
      'DIVERSE_ROUTE_CONFIRMATION',
    ],
    retrieval_queries: [
      'fiber contract signed availability letter',
      'carrier agreement telecommunications contract',
    ],
  },
];

// ════════════════════════════════════════════════════════════════════════════
// COMMERCIAL MODULE FACTS
// ════════════════════════════════════════════════════════════════════════════

export const COMMERCIAL_FACTS: FactDefinition[] = [
  {
    code: 'target_customer_segment',
    module: 'COMMERCIAL',
    label: 'Target Segment',
    type: 'string',
    unit: null,
    hard_gate: false,
    expected_artifacts: ['CUSTOMER_LOI', 'CUSTOMER_CONTRACT_MSA_OR_LEASE'],
    retrieval_queries: [
      'target customer segment hyperscale enterprise cloud',
      'customer type target market segment',
    ],
  },
  {
    code: 'anchor_customer_stage_0_4',
    module: 'COMMERCIAL',
    label: 'Anchor Customer Stage (0-4)',
    type: 'number',
    unit: null,
    hard_gate: false,
    expected_artifacts: ['CUSTOMER_LOI', 'CUSTOMER_CONTRACT_MSA_OR_LEASE'],
    retrieval_queries: [
      'anchor customer LOI letter of intent',
      'customer contract signed MSA lease',
      'prelet pre-lease anchor tenant',
    ],
  },
  {
    code: 'prelet_mw',
    module: 'COMMERCIAL',
    label: 'Prelet MW',
    type: 'number',
    unit: 'MW',
    hard_gate: false,
    expected_artifacts: ['CUSTOMER_LOI', 'CUSTOMER_CONTRACT_MSA_OR_LEASE'],
    retrieval_queries: [
      'prelet capacity MW contracted reserved',
      'customer commitment capacity megawatts',
    ],
  },
  {
    code: 'commercial_title_level_0_4',
    module: 'COMMERCIAL',
    label: 'Commercial Level (0-4)',
    type: 'number',
    unit: null,
    hard_gate: false,
    expected_artifacts: ['CUSTOMER_LOI', 'CUSTOMER_CONTRACT_MSA_OR_LEASE'],
    retrieval_queries: [
      'customer contract signed binding agreement',
      'LOI term sheet customer commitment',
    ],
  },
];

// ════════════════════════════════════════════════════════════════════════════
// COMBINED FACT CATALOG
// ════════════════════════════════════════════════════════════════════════════

export const FACT_CATALOG_V1: FactDefinition[] = [
  ...POWER_GRID_FACTS,
  ...PERMITS_LAND_FACTS,
  ...CONNECTIVITY_FACTS,
  ...COMMERCIAL_FACTS,
];

// ════════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Get all facts for a specific module
 */
export function getFactsByModule(module: DDModuleV1): FactDefinition[] {
  return FACT_CATALOG_V1.filter((f) => f.module === module);
}

/**
 * Get all hard gate facts
 */
export function getHardGateFacts(): FactDefinition[] {
  return FACT_CATALOG_V1.filter((f) => f.hard_gate);
}

/**
 * Get fact definition by code
 */
export function getFactByCode(code: string): FactDefinition | undefined {
  return FACT_CATALOG_V1.find((f) => f.code === code);
}

/**
 * Get all unique retrieval queries for a module
 */
export function getRetrievalQueriesByModule(module: DDModuleV1): string[] {
  const facts = getFactsByModule(module);
  const queries = new Set<string>();
  for (const fact of facts) {
    for (const query of fact.retrieval_queries) {
      queries.add(query);
    }
  }
  return Array.from(queries);
}

/**
 * Get all retrieval queries across all modules
 */
export function getAllRetrievalQueries(): string[] {
  const queries = new Set<string>();
  for (const fact of FACT_CATALOG_V1) {
    for (const query of fact.retrieval_queries) {
      queries.add(query);
    }
  }
  return Array.from(queries);
}

/**
 * Map fact codes to their expected artifact types
 */
export function getExpectedArtifactsForFact(factCode: string): ArtifactType[] {
  const fact = getFactByCode(factCode);
  return fact?.expected_artifacts ?? [];
}

// ════════════════════════════════════════════════════════════════════════════
// RETRIEVAL QUERY GROUPS (optimized for vector store search)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Grouped queries for efficient retrieval (reduces API calls)
 */
export const RETRIEVAL_QUERY_GROUPS = {
  POWER_GRID: [
    'grid connection agreement capacity MW reserved firm',
    'connection voltage kV substation point',
    'energisation date target COD milestone',
    'curtailment cap flex non-firm interruptible',
    'grid offer signed deposit payment proof',
    'queue position expiry deadline acceptance',
    'deep works reinforcement network upgrade',
  ],
  PERMITS_LAND: [
    'land ownership lease option control freehold',
    'planning permission granted application submitted',
    'environmental permit EIA assessment approval',
    'building permit construction consent',
    'cable route wayleave easement rights',
    'land control expiry lease option term',
  ],
  CONNECTIVITY: [
    'fiber availability dark fiber connectivity',
    'carrier count diverse routes redundancy',
    'telecommunications contract quote agreement',
  ],
  COMMERCIAL: [
    'anchor customer LOI letter of intent contract',
    'prelet capacity MW customer commitment',
    'MSA lease contract signed binding agreement',
  ],
} as const;

export type RetrievalQueryGroup = keyof typeof RETRIEVAL_QUERY_GROUPS;
