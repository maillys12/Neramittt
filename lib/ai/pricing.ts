import type { TokenUsage } from '@/lib/ai/types';

// Verified against OpenAI model/pricing docs on 2026-09-19.
// Web search tool calls: $10 / 1,000 calls = $0.01/call.
type PriceRow = {
  version: string;
  inputUsdPerMillion: number;
  cachedInputUsdPerMillion: number;
  outputUsdPerMillion: number;
};

const MODEL_PRICES: Record<string, PriceRow> = {
  'gpt-5.6-luna': { version: 'openai-2026-09-19', inputUsdPerMillion: 0.20, cachedInputUsdPerMillion: 0.02, outputUsdPerMillion: 1.20 },
  'gpt-5.6-terra': { version: 'openai-2026-09-19', inputUsdPerMillion: 2.00, cachedInputUsdPerMillion: 0.20, outputUsdPerMillion: 12.00 },
  'gpt-5.6-sol': { version: 'openai-2026-09-19', inputUsdPerMillion: 4.00, cachedInputUsdPerMillion: 0.40, outputUsdPerMillion: 20.00 },
  'gpt-5.6': { version: 'openai-2026-09-19', inputUsdPerMillion: 4.00, cachedInputUsdPerMillion: 0.40, outputUsdPerMillion: 20.00 },
};

const WEB_SEARCH_USD_PER_CALL = 0.01;

export function calculateEstimatedCost(input: { model: string; usage: TokenUsage; usdToThb: number }) {
  const row = MODEL_PRICES[input.model];
  if (!row) throw new Error('AI_PRICE_UNKNOWN');
  if (!Number.isFinite(input.usdToThb) || input.usdToThb <= 0) throw new Error('AI_EXCHANGE_RATE_INVALID');

  const cached = Math.max(0, Math.min(input.usage.cachedTokens, input.usage.inputTokens));
  const uncached = Math.max(0, input.usage.inputTokens - cached);
  const usd =
    uncached / 1_000_000 * row.inputUsdPerMillion +
    cached / 1_000_000 * row.cachedInputUsdPerMillion +
    Math.max(0, input.usage.outputTokens) / 1_000_000 * row.outputUsdPerMillion +
    Math.max(0, input.usage.toolCalls ?? 0) * WEB_SEARCH_USD_PER_CALL;

  return { usd, thb: usd * input.usdToThb, pricingVersion: row.version };
}

export function supportedPricingModels() {
  return Object.keys(MODEL_PRICES);
}
