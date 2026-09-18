import type { AIStage, AIRuntimeConfig, ReasoningEffort } from '@/lib/ai/types';
import { AUTO_MODEL_BY_STAGE, SAFE_STAGE_CONFIG, isAllowedAIModel } from '@/lib/ai/safe-defaults';

export type BudgetRoutingPolicy = {
  forceCostSaver?: boolean;
  forcedModel?: string;
  forcedReasoning?: ReasoningEffort;
  disabledStages?: AIStage[];
  paused?: boolean;
};

export function resolveModelForStage(input: { stage: AIStage; runtime: AIRuntimeConfig; budgetPolicy?: BudgetRoutingPolicy }) {
  const { stage, runtime, budgetPolicy } = input;
  const safe = SAFE_STAGE_CONFIG[stage];
  if (runtime.safeMode) return { model: safe.fallbackModel, fallbackModel: safe.fallbackModel, reasoningEffort: safe.reasoningEffort, maxOutputTokens: safe.maxOutputTokens, source: 'safe_mode' as const };
  if (budgetPolicy?.paused) throw new Error('AI_PAUSED');
  if (budgetPolicy?.disabledStages?.includes(stage)) throw new Error('AI_STAGE_DISABLED');

  const stageConfig = runtime.stages[stage] ?? safe;
  if (budgetPolicy?.forcedModel && isAllowedAIModel(budgetPolicy.forcedModel)) {
    return {
      model: budgetPolicy.forcedModel,
      fallbackModel: stageConfig.fallbackModel,
      reasoningEffort: budgetPolicy.forcedReasoning ?? stageConfig.reasoningEffort,
      maxOutputTokens: stageConfig.maxOutputTokens,
      source: 'budget_guard' as const,
    };
  }
  if (budgetPolicy?.forceCostSaver) {
    return { model: 'gpt-5.6-luna', fallbackModel: 'gpt-5.6-luna', reasoningEffort: budgetPolicy.forcedReasoning ?? 'low', maxOutputTokens: Math.min(stageConfig.maxOutputTokens, 1800), source: 'budget_guard' as const };
  }

  const baseModel = stageConfig.mode === 'manual' && stageConfig.modelOverride && isAllowedAIModel(stageConfig.modelOverride)
    ? stageConfig.modelOverride
    : runtime.autoRoutingEnabled ? AUTO_MODEL_BY_STAGE[stage] : safe.fallbackModel;
  const baseSource = stageConfig.mode === 'manual' && stageConfig.modelOverride && isAllowedAIModel(stageConfig.modelOverride)
    ? 'manual' as const
    : 'auto' as const;

  if (budgetPolicy?.forcedReasoning) {
    return {
      model: baseModel,
      fallbackModel: stageConfig.fallbackModel,
      reasoningEffort: budgetPolicy.forcedReasoning,
      maxOutputTokens: stageConfig.maxOutputTokens,
      source: 'budget_guard' as const,
    };
  }

  return {
    model: baseModel,
    fallbackModel: stageConfig.fallbackModel,
    reasoningEffort: stageConfig.reasoningEffort,
    maxOutputTokens: stageConfig.maxOutputTokens,
    source: baseSource,
  };
}

export function isEligibleFallbackError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /rate.?limit|timeout|timed out|model|overloaded|unavailable|5\d\d/i.test(message);
}
