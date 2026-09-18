import { getServerSupabase } from '@/lib/supabase/server';
import { getAIRuntimeConfig } from '@/lib/ai/config';
import { getBudgetSnapshot, getCostWindows } from '@/lib/ai/budget';
import { actionsToRoutingPolicy, evaluateBudgetGuard, type BudgetRule } from '@/lib/ai/budget-guard';
import { createAdminNotification } from '@/lib/ai/notifications';
import type { AIStage } from '@/lib/ai/types';

export async function getBudgetGuardForStage(stage: AIStage) {
  const runtime = await getAIRuntimeConfig();
  if (runtime.safeMode) return { runtime, mode: 'normal' as const, actions: [], routingPolicy: {} };
  try {
    const db = getServerSupabase();
    const [{ data: rows, error }, budget, costs] = await Promise.all([
      db.from('ai_budget_rules').select('*').eq('enabled', true).order('priority', { ascending: true }),
      getBudgetSnapshot(),
      getCostWindows(),
    ]);
    if (error) throw error;
    if (!budget.enabled) return { runtime, mode: 'normal' as const, actions: [], routingPolicy: {} };
    const rules: BudgetRule[] = (rows ?? []).map(row => ({
      id: String(row.id),
      enabled: Boolean(row.enabled),
      priority: Number(row.priority),
      conditionMetric: row.condition_metric,
      operator: row.operator,
      threshold: Number(row.threshold),
      action: row.action,
      actionConfig: row.action_config ?? {},
    }));
    const evaluated = evaluateBudgetGuard({ snapshot: { ...budget, ...costs }, rules, stage });
    for (const action of evaluated.actions) {
      if (action.type === 'notify_warning' || action.type === 'notify_critical') {
        await createAdminNotification({
          severity: action.type === 'notify_critical' ? 'critical' : 'warning',
          source: 'budget_guard',
          title: action.type === 'notify_critical' ? 'AI budget critical' : 'AI budget warning',
          message: `AI budget used ${budget.usedPercent.toFixed(1)}% (${budget.usedThb.toFixed(2)} / ${budget.monthlyBudgetThb.toFixed(2)} THB)`,
          dedupeKey: `${action.type}:${budget.periodStart}`,
        });
      }
    }
    return { runtime, ...evaluated, routingPolicy: actionsToRoutingPolicy(evaluated.actions) };
  } catch {
    return { runtime, mode: 'normal' as const, actions: [], routingPolicy: {} };
  }
}
