import 'server-only';
import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  console.warn('OPENAI_API_KEY is not set; OpenAI features will be disabled.');
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// GPT-4o is the most capable model for complex analysis tasks
// Can be overridden via OPENAI_MODEL env var (e.g., 'gpt-4-turbo', 'gpt-4o-mini' for cost savings)
export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
