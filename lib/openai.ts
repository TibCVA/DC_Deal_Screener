import 'server-only';
import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  console.warn('OPENAI_API_KEY is not set; OpenAI features will be disabled.');
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ════════════════════════════════════════════════════════════════════════════
// MODEL CONFIGURATION
// ════════════════════════════════════════════════════════════════════════════

/**
 * OpenAI Model Selection
 *
 * Supported models:
 * - gpt-4o: Best for complex analysis (default)
 * - gpt-4o-mini: Cost-effective for simpler tasks
 * - gpt-5.1: Enhanced reasoning capabilities
 * - gpt-5.2: Latest model with advanced reasoning
 *
 * Override via OPENAI_MODEL env var
 */
export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

/**
 * Reasoning Effort for GPT-5.x models
 *
 * Controls how much reasoning the model applies:
 * - 'none': No extended reasoning
 * - 'low': Minimal reasoning
 * - 'medium': Balanced reasoning (good default)
 * - 'high': Deep reasoning for complex tasks
 * - 'xhigh': Maximum reasoning (highest quality, slower)
 *
 * Only applies to GPT-5.x models. Ignored for GPT-4.x.
 * Override via OPENAI_REASONING_EFFORT env var
 */
export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh';

export const OPENAI_REASONING_EFFORT: ReasoningEffort =
  (process.env.OPENAI_REASONING_EFFORT as ReasoningEffort | undefined) || 'high';

/**
 * Returns reasoning configuration for GPT-5.x models
 * Returns undefined for non-GPT-5.x models (safe to spread into API calls)
 */
export function getOpenAIReasoning(): { effort: ReasoningEffort } | undefined {
  if (!OPENAI_MODEL.startsWith('gpt-5')) {
    return undefined;
  }
  return { effort: OPENAI_REASONING_EFFORT };
}

/**
 * Check if current model supports reasoning
 */
export function supportsReasoning(): boolean {
  return OPENAI_MODEL.startsWith('gpt-5');
}

/**
 * Get model info for logging/auditing
 */
export function getModelInfo(): { model: string; reasoningEffort: ReasoningEffort | null } {
  return {
    model: OPENAI_MODEL,
    reasoningEffort: supportsReasoning() ? OPENAI_REASONING_EFFORT : null,
  };
}
