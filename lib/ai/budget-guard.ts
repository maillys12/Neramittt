import type { AIStage, BudgetSnapshot, ReasoningEffort } from '@/lib/ai/types';
import { isAllowedAIModel } from '@/lib/ai/safe-defaults';

export type BudgetRule = {
  id: string;
  enabled: boolean;
  priority: number;
  conditionMetric: 'budget_used_percent' | 'budget_remaining_thb' | 'daily_cost_thb' | 'monthly_cost_thb';
  operator: 'gte' | 'lte' | 'gt' | 'lt';
  threshold: number;
  action: 'notify_warning' | 'notify_critical' | 'cost_saver' | 'reduce_reasoning' | 'force_model' | 'disable_stage' | 'pause_ai';
  actionConfig: Record<string, unknown>;
};

export type BudgetGuardAction =
  | { type: 'notify_warning' }
  | { type: 'notify_critical' }
  | { type: 'cost_saver' }
  | { type: 'reduce_reasoning'; effort: ReasoningEffort }
  | { type: 'force_model'; model: string }
  | { type: 'disable_stage'; stage: AIStage }
  | { type: 'pause_ai' };

function compare(value: number, operator: BudgetRule['operator'], threshold: number) {
  if (operator === 'gte') return value >= threshold;
  if (operator === 'lte') return value <= threshold;
  if (operator === 'gt') return value > threshold;
  return value < threshold;
}

export function normalizeBudgetAction(rule: BudgetRule): BudgetGuardAction | null {
  if (rule.action === 'notify_warning' || rule.action === 'notify_critical' || rule.action === 'cost_saver' || rule.action === 'pause_ai') return { type: rule.action };
  if (rule.action === 'reduce_reasoning') {
    const effort = String(rule.actionConfig.effort ?? 'low') as ReasoningEffort;
    return ['none','low','medium','high','xhigh','max'].includes(effort) ? { type: 'reduce_reasoning', effort } : null;
  }
  if (rule.action === 'force_model') {
    const model = String(rule.actionConfig.model ?? '');
    return isAllowedAIModel(model) ? { type: 'force_model', model } : null;
  }
  if (rule.action === 'disable_stage') {
    const stage = String(rule.actionConfig.stage ?? '') as AIStage;
    return ['requirement','research','creative_director','final_prompt','repair'].includes(stage) ? { type: 'disable_stage', stage } : null;
  }
  return null;
}

export function evaluateBudgetGuard(input: {
  snapshot: BudgetSnapshot & { dailyCostThb: number; monthlyCostThb: number };
  rules: BudgetRule[];
  stage: AIStage;
}) {
  const metrics: Record<BudgetRule['conditionMetric'], number> = {
    budget_used_percent: input.snapshot.usedPercent,
    budget_remaining_thb: input.snapshot.remainingThb,
    daily_cost_thb: input.snapshot.dailyCostThb,
    monthly_cost_thb: input.snapshot.monthlyCostThb,
  };
  const actions = input.rules
    .filter(rule => rule.enabled && compare(metrics[rule.conditionMetric], rule.operator, rule.threshold))
    .sort((a,b) => a.priority - b.priority)
    .map(normalizeBudgetAction)
    .filter((action): action is BudgetGuardAction => Boolean(action));
  const applicable = actions.filter(action => action.type !== 'disable_stage' || action.stage === input.stage);
  const mode = applicable.some(a => a.type === 'pause_ai') ? 'paused'
    : applicable.some(a => a.type === 'disable_stage') ? 'restricted'
    : applicable.some(a => a.type === 'cost_saver' || a.type === 'force_model' || a.type === 'reduce_reasoning') ? 'cost_saver'
    : applicable.some(a => a.type === 'notify_critical' || a.type === 'notify_warning') ? 'warning'
    : 'normal';
  return { mode: mode as 'normal'|'warning'|'cost_saver'|'restricted'|'paused', actions: applicable };
}

export function actionsToRoutingPolicy(actions: BudgetGuardAction[]) {
  const forced = actions.find(a => a.type === 'force_model') as Extract<BudgetGuardAction,{type:'force_model'}>|undefined;
  const effort = actions.find(a => a.type === 'reduce_reasoning') as Extract<BudgetGuardAction,{type:'reduce_reasoning'}>|undefined;
  return {
    forceCostSaver: actions.some(a => a.type === 'cost_saver'),
    forcedModel: forced?.model,
    forcedReasoning: effort?.effort,
    disabledStages: actions.filter((a): a is Extract<BudgetGuardAction,{type:'disable_stage'}> => a.type === 'disable_stage').map(a => a.stage),
    paused: actions.some(a => a.type === 'pause_ai'),
  };
}
