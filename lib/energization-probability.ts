/**
 * ENERGIZATION PROBABILITY CALCULATOR
 *
 * Calculates probability of energization at different time horizons (T+12m, T+24m, T+36m)
 * based on extracted evidence and risk factors.
 *
 * IMPORTANT: This is NOT a statistically calibrated probability.
 * It is a structured scoring function that produces comparable outputs across deals.
 */

import { z } from 'zod';

// ════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════

export const EnergizationProbabilityResult = z.object({
  // Probabilities at time horizons
  t_12m: z.number().min(0).max(100),
  t_24m: z.number().min(0).max(100),
  t_36m: z.number().min(0).max(100),

  // Key drivers (factors increasing probability)
  key_drivers: z.array(z.string()),

  // Key risks (factors decreasing probability)
  key_risks: z.array(z.string()),

  // Scenario descriptions
  scenario_base: z.string(),
  scenario_bear: z.string(),
  scenario_bull: z.string(),

  // Confidence in the calculation
  calculation_confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),

  // Methodology note
  methodology_note: z.string(),
});

export type EnergizationProbabilityResultType = z.infer<typeof EnergizationProbabilityResult>;

// ════════════════════════════════════════════════════════════════════════════
// SCORING FACTORS
// ════════════════════════════════════════════════════════════════════════════

interface ScoringFactor {
  id: string;
  name: string;
  weight: number; // Impact on base score
  evaluator: (facts: Record<string, any>) => { score: number; note: string | null };
}

const POSITIVE_FACTORS: ScoringFactor[] = [
  {
    id: 'power_title',
    name: 'Power Title Level',
    weight: 25,
    evaluator: (facts) => {
      const level = facts.power_title_level?.value ?? facts.power_title_level ?? 0;
      if (level >= 5) return { score: 25, note: 'Binding grid agreement (level 5)' };
      if (level >= 4) return { score: 20, note: 'Accepted offer with deposit (level 4)' };
      if (level >= 3) return { score: 12, note: 'Offer received (level 3)' };
      if (level >= 2) return { score: 6, note: 'In queue (level 2)' };
      return { score: 0, note: null };
    },
  },
  {
    id: 'firmness',
    name: 'Connection Firmness',
    weight: 15,
    evaluator: (facts) => {
      const firmness = facts.firmness_type?.value ?? facts.firmness_type;
      if (firmness === 'firm') return { score: 15, note: 'Firm connection terms' };
      if (firmness === 'flex') return { score: 8, note: 'Flex connection (managed curtailment)' };
      if (firmness === 'non_firm') return { score: 4, note: 'Non-firm connection' };
      return { score: 0, note: null };
    },
  },
  {
    id: 'building_permit',
    name: 'Building Permit',
    weight: 15,
    evaluator: (facts) => {
      const status = facts.building_permit_status?.value ?? facts.building_permit_status ?? facts.permits_status?.value;
      if (status === 'granted') return { score: 15, note: 'Building permit granted' };
      if (status === 'applied') return { score: 7, note: 'Building permit application submitted' };
      return { score: 0, note: null };
    },
  },
  {
    id: 'land_control',
    name: 'Land Control',
    weight: 10,
    evaluator: (facts) => {
      const control = facts.land_control_type?.value ?? facts.land_control_type;
      if (control === 'freehold') return { score: 10, note: 'Freehold land ownership' };
      if (control === 'leasehold') return { score: 9, note: 'Leasehold secured' };
      if (control === 'option') return { score: 5, note: 'Land option in place' };
      if (control === 'letter_of_intent') return { score: 2, note: 'Land LOI only' };
      return { score: 0, note: null };
    },
  },
  {
    id: 'commercial',
    name: 'Commercial Traction',
    weight: 10,
    evaluator: (facts) => {
      if (facts.contract_signed?.value) return { score: 10, note: 'Customer contract signed' };
      if (facts.loi_signed?.value) return { score: 6, note: 'Customer LOI signed' };
      if (facts.anchor_tenant?.value) return { score: 3, note: 'Anchor tenant identified' };
      if (facts.customer_traction?.value) return { score: 3, note: 'Customer interest evidenced' };
      return { score: 0, note: null };
    },
  },
  {
    id: 'energization_date',
    name: 'Energization Date Defined',
    weight: 10,
    evaluator: (facts) => {
      const target = facts.energization_target?.value ?? facts.energization_target;
      if (target) return { score: 10, note: `Target energization: ${target}` };
      return { score: 0, note: null };
    },
  },
];

const NEGATIVE_FACTORS: ScoringFactor[] = [
  {
    id: 'deep_works',
    name: 'Deep Works Required',
    weight: -15,
    evaluator: (facts) => {
      if (facts.deep_works_required?.value === true) {
        return { score: -15, note: 'Grid reinforcement works required' };
      }
      return { score: 0, note: null };
    },
  },
  {
    id: 'queue_risk',
    name: 'Queue Position Risk',
    weight: -10,
    evaluator: (facts) => {
      const position = facts.queue_position?.value;
      if (position && position > 50) return { score: -10, note: `High queue position (#${position})` };
      if (position && position > 20) return { score: -5, note: `Moderate queue position (#${position})` };
      return { score: 0, note: null };
    },
  },
  {
    id: 'permit_risk',
    name: 'Permit Appeal Risk',
    weight: -10,
    evaluator: (facts) => {
      if (facts.permit_appeal_risk?.value) return { score: -10, note: 'Permit appeal risk identified' };
      if (facts.neighbor_opposition?.value) return { score: -8, note: 'Neighbor opposition noted' };
      return { score: 0, note: null };
    },
  },
  {
    id: 'no_grid_agreement',
    name: 'Missing Grid Agreement',
    weight: -20,
    evaluator: (facts) => {
      if (facts.grid_connection_agreement?.value === false ||
          (facts.power_title_level?.value ?? 0) < 3) {
        return { score: -20, note: 'No grid connection agreement' };
      }
      return { score: 0, note: null };
    },
  },
  {
    id: 'curtailment_high',
    name: 'High Curtailment',
    weight: -10,
    evaluator: (facts) => {
      const cap = facts.curtailment_cap_percent?.value;
      if (cap && cap > 20) return { score: -10, note: `High curtailment cap (${cap}%)` };
      if (cap && cap > 10) return { score: -5, note: `Moderate curtailment cap (${cap}%)` };
      return { score: 0, note: null };
    },
  },
];

// ════════════════════════════════════════════════════════════════════════════
// CALCULATION FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Calculate energization probability
 */
export function calculateEnergizationProbability(
  extractedFacts: Record<string, any>,
  redFlagCount: number = 0,
  contradictionCount: number = 0
): EnergizationProbabilityResultType {
  const drivers: string[] = [];
  const risks: string[] = [];
  let baseScore = 30; // Starting point

  // Apply positive factors
  for (const factor of POSITIVE_FACTORS) {
    const result = factor.evaluator(extractedFacts);
    if (result.score > 0 && result.note) {
      baseScore += result.score;
      drivers.push(result.note);
    }
  }

  // Apply negative factors
  for (const factor of NEGATIVE_FACTORS) {
    const result = factor.evaluator(extractedFacts);
    if (result.score < 0 && result.note) {
      baseScore += result.score;
      risks.push(result.note);
    }
  }

  // Apply red flag and contradiction penalties
  const redFlagPenalty = redFlagCount * 8;
  const contradictionPenalty = contradictionCount * 5;
  baseScore -= redFlagPenalty;
  baseScore -= contradictionPenalty;

  if (redFlagCount > 0) {
    risks.push(`${redFlagCount} red flag(s) identified`);
  }
  if (contradictionCount > 0) {
    risks.push(`${contradictionCount} contradiction(s) in evidence`);
  }

  // Clamp base score
  baseScore = Math.max(5, Math.min(95, baseScore));

  // Calculate time-horizon probabilities
  // T+12m: Lower than base (less time to resolve issues)
  // T+24m: Base score
  // T+36m: Higher than base (more time to resolve)

  const t_12m = calculateTimeAdjustedProbability(baseScore, 12, extractedFacts);
  const t_24m = calculateTimeAdjustedProbability(baseScore, 24, extractedFacts);
  const t_36m = calculateTimeAdjustedProbability(baseScore, 36, extractedFacts);

  // Generate scenarios
  const scenarios = generateScenarios(baseScore, drivers, risks, extractedFacts);

  // Determine calculation confidence
  const evidenceCount = Object.values(extractedFacts).filter(f => f?.value !== null).length;
  const calculationConfidence = evidenceCount >= 6 ? 'HIGH' : evidenceCount >= 3 ? 'MEDIUM' : 'LOW';

  return EnergizationProbabilityResult.parse({
    t_12m,
    t_24m,
    t_36m,
    key_drivers: drivers,
    key_risks: risks,
    scenario_base: scenarios.base,
    scenario_bear: scenarios.bear,
    scenario_bull: scenarios.bull,
    calculation_confidence: calculationConfidence,
    methodology_note: 'This is a structured scoring function based on evidence verification, not a statistically calibrated probability. Scores are comparable across deals but should not be interpreted as true probabilities.',
  });
}

/**
 * Adjust probability for time horizon
 */
function calculateTimeAdjustedProbability(
  baseScore: number,
  monthsHorizon: number,
  facts: Record<string, any>
): number {
  // Get target energization if available
  const targetDate = facts.energization_target?.value;
  let targetMonths: number | null = null;

  if (targetDate) {
    const target = new Date(targetDate);
    const now = new Date();
    targetMonths = Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30));
  }

  let adjustedScore = baseScore;

  if (monthsHorizon === 12) {
    // 12-month horizon: More pessimistic
    adjustedScore = baseScore * 0.7;

    // If target is beyond 12 months, reduce further
    if (targetMonths && targetMonths > 18) {
      adjustedScore *= 0.5;
    }
  } else if (monthsHorizon === 24) {
    // 24-month horizon: Base case
    // If target aligns well, slight boost
    if (targetMonths && targetMonths <= 24) {
      adjustedScore *= 1.05;
    }
  } else if (monthsHorizon === 36) {
    // 36-month horizon: More optimistic
    adjustedScore = baseScore * 1.15;

    // Cap at reasonable level
    if (adjustedScore > 90 && baseScore < 80) {
      adjustedScore = 90;
    }
  }

  return Math.round(Math.max(5, Math.min(95, adjustedScore)));
}

/**
 * Generate scenario descriptions
 */
function generateScenarios(
  baseScore: number,
  drivers: string[],
  risks: string[],
  facts: Record<string, any>
): { base: string; bear: string; bull: string } {
  const targetDate = facts.energization_target?.value || 'TBD';
  const mw = facts.reserved_mw?.value || 'TBD';

  // Base scenario
  const base = `Base case assumes ${mw}MW energization around ${targetDate} with current evidence supporting ${baseScore}% confidence. Key dependencies: ${drivers.slice(0, 2).join(', ') || 'Evidence pending'}.`;

  // Bear scenario
  const bearRisks = risks.slice(0, 2).join('; ') || 'No specific risks identified';
  const bear = `Bear case considers downside from: ${bearRisks}. Could result in 6-12 month delay or capacity reduction. Monitor milestone compliance and permit timelines.`;

  // Bull scenario
  const bullFactors = drivers.slice(0, 2).join('; ') || 'Evidence improvements';
  const bull = `Bull case if: ${bullFactors} are further de-risked. Potential for accelerated timeline if grid works completed early and permits remain unchallenged.`;

  return { base, bear, bull };
}

// ════════════════════════════════════════════════════════════════════════════
// TIMELINE ANALYSIS
// ════════════════════════════════════════════════════════════════════════════

export interface TimelineRisk {
  milestone: string;
  target_date: string | null;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  days_remaining: number | null;
  note: string;
}

/**
 * Analyze timeline risks
 */
export function analyzeTimelineRisks(facts: Record<string, any>): TimelineRisk[] {
  const risks: TimelineRisk[] = [];
  const now = new Date();

  // Check queue expiry
  if (facts.queue_expiry_date?.value) {
    const expiry = new Date(facts.queue_expiry_date.value);
    const daysRemaining = Math.round((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    risks.push({
      milestone: 'Queue Position Expiry',
      target_date: facts.queue_expiry_date.value,
      risk_level: daysRemaining < 90 ? 'CRITICAL' : daysRemaining < 180 ? 'HIGH' : 'MEDIUM',
      days_remaining: daysRemaining,
      note: daysRemaining < 90 ? 'URGENT: Queue position at risk' : 'Monitor milestone compliance',
    });
  }

  // Check milestone deadline
  if (facts.milestone_deadline?.value) {
    const deadline = new Date(facts.milestone_deadline.value);
    const daysRemaining = Math.round((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    risks.push({
      milestone: facts.milestone_next?.value || 'Next Milestone',
      target_date: facts.milestone_deadline.value,
      risk_level: daysRemaining < 60 ? 'CRITICAL' : daysRemaining < 120 ? 'HIGH' : 'MEDIUM',
      days_remaining: daysRemaining,
      note: `Milestone: ${facts.milestone_next?.value || 'Unknown'}`,
    });
  }

  // Check building permit expiry
  if (facts.building_permit_expiry?.value) {
    const expiry = new Date(facts.building_permit_expiry.value);
    const daysRemaining = Math.round((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    risks.push({
      milestone: 'Building Permit Expiry',
      target_date: facts.building_permit_expiry.value,
      risk_level: daysRemaining < 180 ? 'HIGH' : 'LOW',
      days_remaining: daysRemaining,
      note: daysRemaining < 180 ? 'Consider renewal process' : 'Permit valid',
    });
  }

  // Check energization target
  if (facts.energization_target?.value) {
    const target = new Date(facts.energization_target.value);
    const daysRemaining = Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    risks.push({
      milestone: 'Energization Target',
      target_date: facts.energization_target.value,
      risk_level: 'MEDIUM',
      days_remaining: daysRemaining,
      note: `Target in ${Math.round(daysRemaining / 30)} months`,
    });
  }

  return risks.sort((a, b) => (a.days_remaining || 999) - (b.days_remaining || 999));
}

// ════════════════════════════════════════════════════════════════════════════
// KILL DATE ANALYSIS
// ════════════════════════════════════════════════════════════════════════════

export interface KillDate {
  date: string;
  type: string;
  consequence: string;
  mitigation: string;
}

/**
 * Identify kill dates (hard deadlines that could kill the deal)
 */
export function identifyKillDates(facts: Record<string, any>): KillDate[] {
  const killDates: KillDate[] = [];

  if (facts.queue_expiry_date?.value) {
    killDates.push({
      date: facts.queue_expiry_date.value,
      type: 'Queue Expiry',
      consequence: 'Loss of grid capacity reservation',
      mitigation: 'Ensure milestone compliance; request extension if available',
    });
  }

  if (facts.building_permit_expiry?.value) {
    killDates.push({
      date: facts.building_permit_expiry.value,
      type: 'Permit Expiry',
      consequence: 'Construction authorization lapses',
      mitigation: 'Begin renewal process 6+ months before expiry',
    });
  }

  if (facts.lease_expiry?.value) {
    killDates.push({
      date: facts.lease_expiry.value,
      type: 'Lease Expiry',
      consequence: 'Loss of land control',
      mitigation: 'Negotiate renewal or exercise options early',
    });
  }

  return killDates.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
