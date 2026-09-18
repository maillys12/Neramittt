import type { TokenUsage } from '@/lib/ai/types';

// Verified against the official OpenAI API pricing page on 2026-09-19.
// GPT-5.6 uses a long-context tier when input exceeds 272K tokens.
// Web search is $10 / 1,000 calls = $0.01 per call.
type TierPrice = {
  inputUsdPerMillion: number;
  cachedInputUsdPerMillion: number;
  outputUsdPerMillion: number;
};

type PriceRow = {
  version: string;
  short: TierPrice;
  long: TierPrice;
};

const MODEL_PRICES: Record<string, PriceRow> = {
  'gpt-5.6-luna': {
    version: 'openai-api-pricing-2026-09-19',
    short: { inputUsdPerMillion: 0.10, cachedInputUsdPerMillion: 0.01, outputUsdPerMillion: 0.60 },
    long: { inputUsdPerMillion: 0.20, cachedInputUsdPerMillion: 0.02, outputUsdPerMillion: 0.90 },
  },
  'gpt-5.6-terra': {
    version: 'openai-api-pricing-2026-09-19',
    short: { inputUsdPerMillion: 1.00, cachedInputUsdPerMillion: 0.10, outputUsdPerMillion: 6.00 },
    long: { inputUsdPerMillion: 2.00, cachedInputUsdPerMillion: 0.20, outputUsdPerMillion: 9.00 },
  },
  'gpt-5.6-sol': {
    version: 'openai-api-pricing-2026-09-19',
    short: { inputUsdPerMillion: 2.00, cachedInputUsdPerMillion: 0.20, outputUsdPerMillion: 10.00 },
    long: { inputUsdPerMillion: 4.00, cachedInputUsdPerMillion: 0.40, outputUsdPerMillion: 15.00 },
  },
  'gpt-5.6': {
    version: 'openai-api-pricing-2026-09-19',
    short: { inputUsdPerMillion: 2.00, cachedInputUsdPerMillion: 0.20, outputUsdPerMillion: 10.00 },
    long: { inputUsdPerMillion: 4.00, cachedInputUsdPerMillion: 0.40, outputUsdPerMillion: 15.00 },
  },
};

const WEB_SEARCH_USD_PER_CALL = 0.01;
const LONG_CONTEXT_THRESHOLD = 272_000;

export function calculateEstimatedCost(input: { model: string; usage: TokenUsage; usdToThb: number }) {
  const row = MODEL_PRICES[input.model];
  if (!row) throw new Error('AI_PRICE_UNKNOWN');
  if (!Number.isFinite(input.usdToThb) || input.usdToThb <= 0) throw new Error('AI_EXCHANGE_RATE_INVALID');

  const tier = input.usage.inputTokens > LONG_CONTEXT_THRESHOLD ? row.long : row.short;
  const cached = Math.max(0, Math.min(input.usage.cachedTokens, input.usage.inputTokens));
  const uncached = Math.max(0, input.usage.inputTokens - cached);
  const usd =
    uncached / 1_000_000 * tier.inputUsdPerMillion +
    cached / 1_000_000 * tier.cachedInputUsdPerMillion +
    Math.max(0, input.usage.outputTokens) / 1_000_000 * tier.outputUsdPerMillion +
    Math.max(0, input.usage.toolCalls ?? 0) * WEB_SEARCH_USD_PER_CALL;

  return { usd, thb: usd * input.usdToThb, pricingVersion: row.version };
}

export function supportedPricingModels() {
  return Object.keys(MODEL_PRICES);
}
