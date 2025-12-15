/**
 * Scoring Engine v1 - Deterministic scoring rules
 *
 * Implements:
 * - Hard gates (GO / HOLD / NO_GO)
 * - Module status (VERIFIED / PARTIAL / UNKNOWN)
 * - Energisation curve (heuristic readiness index)
 * - Underwriting tape extraction
 */

import {
  type DDContractV1,
  type DealEvidence,
  type FactValue,
  type FundPolicySnapshot,
  type HardGateResult,
  type ModuleScorecardEntry,
  type OverallScore,
  type Energisation,
  type EnergisationInputs,
  type UnderwritingTapeVariable,
  type ChecklistItem,
  type DDModuleV1,
  UNDERWRITING_TAPE_VARIABLES,
  createDefaultFundPolicy,
} from './dd-contract-v1';

import { getFactByCode, getFactsByModule, getExpectedArtifactsForFact } from './fact-catalog-v1';

// ════════════════════════════════════════════════════════════════════════════
// HARD GATE EVALUATION
// ════════════════════════════════════════════════════════════════════════════

/**
 * Evaluate hard gates based on fund policy and extracted facts
 */
export function evaluateHardGates(
  facts: Record<string, FactValue>,
  policy: FundPolicySnapshot
): HardGateResult {
  const reasons: string[] = [];
  const gatingCitations: string[] = [];
  let hasNoGo = false;
  let hasHold = false;

  // Check power title level
  const powerTitleFact = facts['grid_title_level_0_5'];
  if (powerTitleFact?.value != null) {
    const level = Number(powerTitleFact.value);
    if (level < policy.hard_gates.min_power_title_level) {
      hasNoGo = true;
      reasons.push(
        `Grid title level ${level} below minimum ${policy.hard_gates.min_power_title_level}`
      );
      gatingCitations.push(...powerTitleFact.citations);
    }
  } else {
    hasHold = true;
    reasons.push('Grid title level unknown - cannot assess power security');
  }

  // Check land control level
  const landFact = facts['land_control_level_0_4'];
  if (landFact?.value != null) {
    const level = Number(landFact.value);
    if (level < policy.hard_gates.min_land_control_level) {
      hasNoGo = true;
      reasons.push(
        `Land control level ${level} below minimum ${policy.hard_gates.min_land_control_level}`
      );
      gatingCitations.push(...landFact.citations);
    }
  } else {
    hasHold = true;
    reasons.push('Land control level unknown - cannot assess site security');
  }

  // Check planning level
  const planningFact = facts['planning_permission_level_0_5'];
  if (planningFact?.value != null) {
    const level = Number(planningFact.value);
    if (level < policy.hard_gates.min_planning_level) {
      hasNoGo = true;
      reasons.push(
        `Planning level ${level} below minimum ${policy.hard_gates.min_planning_level}`
      );
      gatingCitations.push(...planningFact.citations);
    }
  } else {
    hasHold = true;
    reasons.push('Planning level unknown - cannot assess permitting status');
  }

  // Check non-firm power policy
  if (!policy.hard_gates.accepts_non_firm_power) {
    const flexMW = facts['grid_reserved_mw_flex'];
    if (flexMW?.value != null && Number(flexMW.value) > 0) {
      hasNoGo = true;
      reasons.push(`Fund policy does not accept non-firm power, but ${flexMW.value} MW flex found`);
      gatingCitations.push(...flexMW.citations);
    }
  }

  // Check flex share percentage
  if (policy.hard_gates.max_flex_share_pct != null) {
    const firmMW = facts['grid_reserved_mw_firm'];
    const flexMW = facts['grid_reserved_mw_flex'];
    if (firmMW?.value != null && flexMW?.value != null) {
      const firm = Number(firmMW.value);
      const flex = Number(flexMW.value);
      const total = firm + flex;
      if (total > 0) {
        const flexShare = (flex / total) * 100;
        if (flexShare > policy.hard_gates.max_flex_share_pct) {
          hasNoGo = true;
          reasons.push(
            `Flex share ${flexShare.toFixed(1)}% exceeds maximum ${policy.hard_gates.max_flex_share_pct}%`
          );
          gatingCitations.push(...firmMW.citations, ...flexMW.citations);
        }
      }
    }
  }

  // Check anchor customer requirement
  if (policy.hard_gates.requires_anchor_customer) {
    const anchorFact = facts['anchor_customer_stage_0_4'];
    if (anchorFact?.value == null || Number(anchorFact.value) < 2) {
      hasNoGo = true;
      reasons.push('Fund requires anchor customer but no LOI/contract evidenced');
    }
  }

  // Check next milestone/expiry
  const nextMilestone = facts['grid_next_milestone_or_expiry_date'];
  if (nextMilestone?.value == null) {
    hasHold = true;
    reasons.push('Next grid milestone/expiry unknown - timeline risk unclear');
  }

  // Determine decision
  let decision: 'GO' | 'HOLD' | 'NO_GO';
  if (hasNoGo) {
    decision = 'NO_GO';
  } else if (hasHold) {
    decision = 'HOLD';
  } else {
    decision = 'GO';
    if (reasons.length === 0) {
      reasons.push('All hard gates passed with evidence');
    }
  }

  return {
    decision,
    reasons,
    gating_citations: [...new Set(gatingCitations)],
  };
}

// ════════════════════════════════════════════════════════════════════════════
// MODULE SCORING
// ════════════════════════════════════════════════════════════════════════════

interface ModuleScoringResult {
  status: 'VERIFIED' | 'PARTIAL' | 'UNKNOWN';
  score: number;
  rationale: string;
  citations: string[];
}

/**
 * Score a single module based on its facts
 */
function scoreModule(
  module: DDModuleV1,
  facts: Record<string, FactValue>
): ModuleScoringResult {
  const moduleFacts = getFactsByModule(module);
  const citations: string[] = [];

  let verifiedCount = 0;
  let partialCount = 0;
  let unknownCount = 0;
  let totalWeight = 0;
  let weightedScore = 0;

  for (const factDef of moduleFacts) {
    const fact = facts[factDef.code];
    const weight = factDef.hard_gate ? 2 : 1; // Hard gate facts count double
    totalWeight += weight;

    if (fact?.value != null && fact.citations.length > 0) {
      verifiedCount++;
      weightedScore += weight * 100;
      citations.push(...fact.citations);
    } else if (fact?.value != null) {
      partialCount++;
      weightedScore += weight * 50;
    } else {
      unknownCount++;
      // No score contribution
    }
  }

  const score = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;

  let status: 'VERIFIED' | 'PARTIAL' | 'UNKNOWN';
  let rationale: string;

  if (unknownCount === moduleFacts.length) {
    status = 'UNKNOWN';
    rationale = 'No evidence found for any facts in this module';
  } else if (verifiedCount >= moduleFacts.length * 0.7) {
    status = 'VERIFIED';
    rationale = `${verifiedCount}/${moduleFacts.length} facts verified with citations`;
  } else {
    status = 'PARTIAL';
    rationale = `${verifiedCount} verified, ${partialCount} partial, ${unknownCount} unknown`;
  }

  return {
    status,
    score,
    rationale,
    citations: [...new Set(citations)],
  };
}

/**
 * Generate module scorecard for all v1 modules
 */
export function generateModuleScorecard(
  facts: Record<string, FactValue>
): ModuleScorecardEntry[] {
  const modules: DDModuleV1[] = ['POWER_GRID', 'PERMITS_LAND', 'COMMERCIAL', 'CONNECTIVITY'];

  return modules.map((mod) => {
    const result = scoreModule(mod, facts);
    return {
      module: mod,
      status: result.status,
      score_0_100: result.score,
      rationale: result.rationale,
      citations: result.citations,
    };
  });
}

/**
 * Calculate overall score from module scores
 */
export function calculateOverallScore(
  moduleScores: ModuleScorecardEntry[],
  policy: FundPolicySnapshot
): OverallScore {
  let totalWeight = 0;
  let weightedScore = 0;
  let verifiedCount = 0;
  let unknownCount = 0;

  for (const entry of moduleScores) {
    const weight = policy.weights[entry.module as keyof typeof policy.weights] ?? 0.1;
    totalWeight += weight;
    weightedScore += weight * entry.score_0_100;

    if (entry.status === 'VERIFIED') verifiedCount++;
    if (entry.status === 'UNKNOWN') unknownCount++;
  }

  const score = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;

  let status: 'VERIFIED' | 'PARTIAL' | 'UNKNOWN';
  if (unknownCount >= moduleScores.length / 2) {
    status = 'UNKNOWN';
  } else if (verifiedCount >= moduleScores.length * 0.7) {
    status = 'VERIFIED';
  } else {
    status = 'PARTIAL';
  }

  const summary = generateExecutiveSummary(moduleScores, score, status);

  return {
    status,
    score_0_100: score,
    executive_summary: summary,
  };
}

function generateExecutiveSummary(
  moduleScores: ModuleScorecardEntry[],
  score: number,
  status: 'VERIFIED' | 'PARTIAL' | 'UNKNOWN'
): string {
  const verified = moduleScores.filter((m) => m.status === 'VERIFIED').map((m) => m.module);
  const unknown = moduleScores.filter((m) => m.status === 'UNKNOWN').map((m) => m.module);

  let summary = `Evidence-first assessment: ${score}% readiness (${status}). `;

  if (verified.length > 0) {
    summary += `Strong evidence in: ${verified.join(', ')}. `;
  }

  if (unknown.length > 0) {
    summary += `Gaps in: ${unknown.join(', ')}. `;
  }

  return summary.trim();
}

// ════════════════════════════════════════════════════════════════════════════
// ENERGISATION PROBABILITY (Heuristic Readiness Index)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Extract energisation inputs from facts
 */
export function extractEnergisationInputs(
  facts: Record<string, FactValue>
): EnergisationInputs {
  return {
    power_title_level: facts['grid_title_level_0_5']?.value != null
      ? Number(facts['grid_title_level_0_5'].value)
      : null,
    permit_level: facts['planning_permission_level_0_5']?.value != null
      ? Number(facts['planning_permission_level_0_5'].value)
      : null,
    land_control_level: facts['land_control_level_0_4']?.value != null
      ? Number(facts['land_control_level_0_4'].value)
      : null,
    firm_reserved_mw: facts['grid_reserved_mw_firm']?.value != null
      ? Number(facts['grid_reserved_mw_firm'].value)
      : null,
    flex_reserved_mw: facts['grid_reserved_mw_flex']?.value != null
      ? Number(facts['grid_reserved_mw_flex'].value)
      : null,
    deep_works_flag: facts['grid_deep_works_flag']?.value != null
      ? Boolean(facts['grid_deep_works_flag'].value)
      : null,
    next_kill_date: facts['grid_next_milestone_or_expiry_date']?.value != null
      ? String(facts['grid_next_milestone_or_expiry_date'].value)
      : null,
  };
}

/**
 * Calculate readiness score (0-100) from inputs
 */
function calculateReadinessScore(inputs: EnergisationInputs): number {
  let score = 0;

  // Power title contribution (30%)
  if (inputs.power_title_level != null) {
    score += (inputs.power_title_level / 5) * 30;
  }

  // Permit level contribution (20%)
  if (inputs.permit_level != null) {
    score += (inputs.permit_level / 5) * 20;
  }

  // Land control contribution (15%)
  if (inputs.land_control_level != null) {
    score += (inputs.land_control_level / 4) * 15;
  }

  // Firmness quality contribution (15%)
  const firm = inputs.firm_reserved_mw ?? 0;
  const flex = inputs.flex_reserved_mw ?? 0;
  const total = firm + flex;
  if (total > 0) {
    const firmShare = firm / total;
    score += firmShare * 15;
  }

  // Deep works penalty (10%)
  if (inputs.deep_works_flag === false) {
    score += 10; // No deep works = bonus
  } else if (inputs.deep_works_flag === true) {
    score += 0; // Deep works = risk
  } else {
    score += 5; // Unknown = partial
  }

  // Milestone presence (10%)
  if (inputs.next_kill_date != null) {
    score += 10;
  }

  return Math.round(Math.min(100, Math.max(0, score)));
}

/**
 * Convert readiness score to probability at different horizons
 * Uses logistic function for smooth mapping
 */
function readinessToProbability(readiness: number, horizonMonths: number): number {
  // Higher horizon = more time = higher probability for same readiness
  const horizonBonus = Math.min(0.15, horizonMonths * 0.005);

  // Logistic function centered at readiness=50
  const k = 0.08; // Steepness
  const x0 = 50; // Midpoint
  const base = 1 / (1 + Math.exp(-k * (readiness - x0)));

  // Apply horizon bonus and cap
  const probability = Math.min(0.95, Math.max(0.05, base + horizonBonus));

  return Math.round(probability * 100) / 100;
}

/**
 * Calculate energisation probability curve
 */
export function calculateEnergisation(
  facts: Record<string, FactValue>
): Energisation {
  const inputs = extractEnergisationInputs(facts);
  const readiness = calculateReadinessScore(inputs);

  const curve = [
    { horizon_months: 12, p: readinessToProbability(readiness, 12) },
    { horizon_months: 24, p: readinessToProbability(readiness, 24) },
    { horizon_months: 36, p: readinessToProbability(readiness, 36) },
  ];

  // Generate explanation
  const drivers: string[] = [];

  if (inputs.power_title_level != null) {
    drivers.push(`Grid title level ${inputs.power_title_level}/5`);
  }
  if (inputs.permit_level != null) {
    drivers.push(`Planning level ${inputs.permit_level}/5`);
  }
  if (inputs.land_control_level != null) {
    drivers.push(`Land control ${inputs.land_control_level}/4`);
  }
  if (inputs.deep_works_flag === true) {
    drivers.push('Deep works required (adds risk)');
  }
  if (inputs.next_kill_date) {
    drivers.push(`Key date: ${inputs.next_kill_date}`);
  }

  const explanation =
    `Heuristic readiness index: ${readiness}/100. ` +
    `Key drivers: ${drivers.length > 0 ? drivers.join('; ') : 'Insufficient evidence'}. ` +
    `P(energisation) at 24m: ${Math.round(curve[1].p * 100)}%.`;

  return {
    method: 'HEURISTIC_READINESS_INDEX',
    inputs,
    curve,
    explanation,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// UNDERWRITING TAPE
// ════════════════════════════════════════════════════════════════════════════

/**
 * Extract underwriting tape from facts
 */
export function extractUnderwritingTape(
  facts: Record<string, FactValue>
): UnderwritingTapeVariable[] {
  return UNDERWRITING_TAPE_VARIABLES.map((variableCode) => {
    const fact = facts[variableCode];
    const factDef = getFactByCode(variableCode);

    let status: 'VERIFIED' | 'PARTIAL' | 'UNKNOWN';
    if (fact?.value != null && fact.citations.length > 0) {
      status = 'VERIFIED';
    } else if (fact?.value != null) {
      status = 'PARTIAL';
    } else {
      status = 'UNKNOWN';
    }

    return {
      variable_code: variableCode,
      value: fact?.value ?? null,
      status,
      citations: fact?.citations ?? [],
      requested_artifact_types: factDef?.expected_artifacts ?? [],
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// CHECKLIST GENERATION
// ════════════════════════════════════════════════════════════════════════════

/**
 * Generate checklist items for missing/partial facts
 */
export function generateChecklist(
  facts: Record<string, FactValue>,
  hardGateResult: HardGateResult
): ChecklistItem[] {
  const items: ChecklistItem[] = [];

  // Add items for hard gate failures
  if (hardGateResult.decision !== 'GO') {
    for (const reason of hardGateResult.reasons) {
      items.push({
        priority: hardGateResult.decision === 'NO_GO' ? 'CRITICAL' : 'HIGH',
        module: 'POWER_GRID', // Default, should be derived from reason
        question: `Resolve: ${reason}`,
        why: 'Hard gate not met',
        requested_artifact_types: [],
        gating: true,
        citations: hardGateResult.gating_citations,
      });
    }
  }

  // Add items for missing facts
  const modules: DDModuleV1[] = ['POWER_GRID', 'PERMITS_LAND', 'COMMERCIAL', 'CONNECTIVITY'];

  for (const mod of modules) {
    const moduleFacts = getFactsByModule(mod);

    for (const factDef of moduleFacts) {
      const fact = facts[factDef.code];

      if (fact?.value == null) {
        items.push({
          priority: factDef.hard_gate ? 'HIGH' : 'MEDIUM',
          module: mod,
          question: `Provide evidence for: ${factDef.label}`,
          why: 'Fact not evidenced in uploaded documents',
          requested_artifact_types: factDef.expected_artifacts,
          gating: factDef.hard_gate,
          citations: [],
        });
      } else if (fact.citations.length === 0) {
        items.push({
          priority: 'MEDIUM',
          module: mod,
          question: `Provide citation for: ${factDef.label}`,
          why: 'Value found but no document reference',
          requested_artifact_types: factDef.expected_artifacts,
          gating: false,
          citations: [],
        });
      }
    }
  }

  // Sort by priority
  const priorityOrder: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };

  items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return items;
}

// ════════════════════════════════════════════════════════════════════════════
// FULL SCORING PIPELINE
// ════════════════════════════════════════════════════════════════════════════

export interface ScoringResult {
  hardGateResult: HardGateResult;
  moduleScorecard: ModuleScorecardEntry[];
  overallScore: OverallScore;
  energisation: Energisation;
  underwritingTape: UnderwritingTapeVariable[];
  checklist: ChecklistItem[];
}

/**
 * Run complete scoring pipeline
 */
export function runScoringPipeline(
  facts: Record<string, FactValue>,
  policy?: FundPolicySnapshot
): ScoringResult {
  const effectivePolicy = policy ?? createDefaultFundPolicy();

  const hardGateResult = evaluateHardGates(facts, effectivePolicy);
  const moduleScorecard = generateModuleScorecard(facts);
  const overallScore = calculateOverallScore(moduleScorecard, effectivePolicy);
  const energisation = calculateEnergisation(facts);
  const underwritingTape = extractUnderwritingTape(facts);
  const checklist = generateChecklist(facts, hardGateResult);

  return {
    hardGateResult,
    moduleScorecard,
    overallScore,
    energisation,
    underwritingTape,
    checklist,
  };
}
