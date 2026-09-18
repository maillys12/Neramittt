import { getServerSupabase } from '@/lib/supabase/server';
import { calculateEstimatedCost } from '@/lib/ai/pricing';
import type { AIExecutionMode, AIStage, TokenUsage } from '@/lib/ai/types';

type ProviderUsageShape = {
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    input_tokens_details?: { cached_tokens?: number };
  };
  output?: Array<{ type?: string }>;
};

export function extractOpenAIUsage(response: unknown): TokenUsage {
  const value = (response && typeof response === 'object' ? response : {}) as ProviderUsageShape;
  const inputTokens = Math.max(0, Number(value.usage?.input_tokens ?? 0) || 0);
  const outputTokens = Math.max(0, Number(value.usage?.output_tokens ?? 0) || 0);
  const cachedTokens = Math.max(0, Math.min(inputTokens, Number(value.usage?.input_tokens_details?.cached_tokens ?? 0) || 0));
  const toolCalls = (value.output ?? []).filter(item => /search_call$/i.test(String(item.type ?? ''))).length;
  return { inputTokens, outputTokens, cachedTokens, toolCalls };
}

async function getUsdToThb() {
  const db = getServerSupabase();
  const { data } = await db.from('ai_budget_config').select('usd_to_thb').eq('id', 1).maybeSingle();
  const value = Number(data?.usd_to_thb ?? 34);
  return Number.isFinite(value) && value > 0 ? value : 34;
}

export async function recordAIUsage(input: {
  requestId: string;
  executionMode: AIExecutionMode;
  stage: AIStage;
  model: string;
  startedAtMs: number;
  response?: unknown;
  status: 'success' | 'error';
  errorCode?: string;
  retryIndex?: number;
  metadata?: Record<string, unknown>;
}) {
  const db = getServerSupabase();
  const usage = extractOpenAIUsage(input.response);
  try {
    const usdToThb = await getUsdToThb();
    const cost = calculateEstimatedCost({ model: input.model, usage, usdToThb });
    const { error } = await db.from('ai_usage_events').insert({
      request_id: input.requestId,
      execution_mode: input.executionMode,
      stage: input.stage,
      model: input.model,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      cached_tokens: usage.cachedTokens,
      tool_calls: usage.toolCalls ?? 0,
      estimated_cost_usd: cost.usd,
      estimated_cost_thb: cost.thb,
      exchange_rate_snapshot: usdToThb,
      pricing_version: cost.pricingVersion,
      duration_ms: Math.max(0, Date.now() - input.startedAtMs),
      status: input.status,
      error_code: input.errorCode ?? null,
      retry_index: input.retryIndex ?? 0,
      metadata: input.metadata ?? {},
    });
    if (error) throw error;
    return { ok: true as const };
  } catch (error) {
    await db.from('error_logs').insert({
      source: 'ai_usage',
      message: error instanceof Error ? error.message : 'AI_USAGE_LOG_FAILED',
      details: { stage: input.stage, model: input.model, requestId: input.requestId },
    });
    return { ok: false as const, error: 'AI_USAGE_LOG_FAILED' as const };
  }
}
