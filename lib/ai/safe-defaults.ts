import type { AIStage, AIRuntimeConfig, StageRuntimeConfig } from '@/lib/ai/types';

export const ALLOWED_AI_MODELS = ['gpt-5.6-luna','gpt-5.6-terra','gpt-5.6-sol','gpt-5.6'] as const;
export type AllowedAIModel = typeof ALLOWED_AI_MODELS[number];

const safe = (stage: AIStage, maxOutputTokens: number): StageRuntimeConfig => ({
  stage,
  mode: 'auto',
  modelOverride: null,
  fallbackModel: 'gpt-5.6-luna',
  reasoningEffort: 'low',
  maxOutputTokens,
});

export const SAFE_STAGE_CONFIG: Record<AIStage, StageRuntimeConfig> = {
  requirement: safe('requirement', 1400),
  research: safe('research', 1400),
  creative_director: safe('creative_director', 2600),
  final_prompt: safe('final_prompt', 2600),
  repair: safe('repair', 1800),
};

export const AUTO_MODEL_BY_STAGE: Record<AIStage, AllowedAIModel> = {
  requirement: 'gpt-5.6-luna',
  research: 'gpt-5.6-luna',
  creative_director: 'gpt-5.6-terra',
  final_prompt: 'gpt-5.6-terra',
  repair: 'gpt-5.6-luna',
};

export const SAFE_RUNTIME_CONFIG: AIRuntimeConfig = {
  safeMode: false,
  autoRoutingEnabled: true,
  stages: SAFE_STAGE_CONFIG,
};

export const SAFE_SYSTEM_PROMPT = '';
export const SAFE_CREATIVE_DIRECTOR_PROMPT = '';

export function isAllowedAIModel(value: string): value is AllowedAIModel {
  return (ALLOWED_AI_MODELS as readonly string[]).includes(value);
}
