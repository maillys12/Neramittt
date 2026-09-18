import { getServerSupabase } from '@/lib/supabase/server';
import { AI_STAGES, REASONING_EFFORTS, type AIRuntimeConfig, type AIStage, type StageRuntimeConfig } from '@/lib/ai/types';
import { SAFE_RUNTIME_CONFIG, SAFE_STAGE_CONFIG, isAllowedAIModel } from '@/lib/ai/safe-defaults';

let cached: { value: AIRuntimeConfig; expiresAt: number } | null = null;
const TTL_MS = 45_000;

function cloneSafe(): AIRuntimeConfig {
  return {
    safeMode: SAFE_RUNTIME_CONFIG.safeMode,
    autoRoutingEnabled: SAFE_RUNTIME_CONFIG.autoRoutingEnabled,
    stages: Object.fromEntries(AI_STAGES.map(stage => [stage, { ...SAFE_STAGE_CONFIG[stage] }])) as Record<AIStage, StageRuntimeConfig>,
  };
}

function normalizeStage(row: Record<string, unknown>, stage: AIStage): StageRuntimeConfig {
  const base = SAFE_STAGE_CONFIG[stage];
  const override = typeof row.model_override === 'string' && isAllowedAIModel(row.model_override) ? row.model_override : null;
  const fallback = typeof row.fallback_model === 'string' && isAllowedAIModel(row.fallback_model) ? row.fallback_model : base.fallbackModel;
  const effort = typeof row.reasoning_effort === 'string' && (REASONING_EFFORTS as readonly string[]).includes(row.reasoning_effort)
    ? row.reasoning_effort as StageRuntimeConfig['reasoningEffort'] : base.reasoningEffort;
  const rawTokens = Number(row.max_output_tokens);
  return {
    stage,
    mode: row.mode === 'manual' ? 'manual' : 'auto',
    modelOverride: override,
    fallbackModel: fallback,
    reasoningEffort: effort,
    maxOutputTokens: Number.isFinite(rawTokens) && rawTokens >= 128 && rawTokens <= 128000 ? rawTokens : base.maxOutputTokens,
  };
}

export async function getAIRuntimeConfig(options?: { bypassCache?: boolean }): Promise<AIRuntimeConfig> {
  if (!options?.bypassCache && cached && cached.expiresAt > Date.now()) return cached.value;
  const fallback = cloneSafe();
  try {
    const db = getServerSupabase();
    const [runtime, stages] = await Promise.all([
      db.from('ai_runtime_config').select('auto_routing_enabled,safe_mode').eq('id', 1).maybeSingle(),
      db.from('ai_stage_config').select('stage,mode,model_override,fallback_model,reasoning_effort,max_output_tokens'),
    ]);
    if (runtime.error || stages.error) throw runtime.error || stages.error;
    const rows = new Map<string, Record<string, unknown>>((stages.data ?? []).map(row => [String(row.stage), row as Record<string, unknown>]));
    const value: AIRuntimeConfig = {
      safeMode: Boolean(runtime.data?.safe_mode),
      autoRoutingEnabled: runtime.data?.auto_routing_enabled !== false,
      stages: Object.fromEntries(AI_STAGES.map(stage => [stage, normalizeStage(rows.get(stage) ?? {}, stage)])) as Record<AIStage, StageRuntimeConfig>,
    };
    cached = { value, expiresAt: Date.now() + TTL_MS };
    return value;
  } catch {
    cached = { value: fallback, expiresAt: Date.now() + 10_000 };
    return fallback;
  }
}

export function invalidateAIRuntimeConfigCache() {
  cached = null;
}
