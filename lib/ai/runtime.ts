import { getServerSupabase } from '@/lib/supabase/server';
import { getAIRuntimeConfig } from '@/lib/ai/config';
import { getBudgetSnapshot, getCostWindows } from '@/lib/ai/budget';
import { actionsToRoutingPolicy, evaluateBudgetGuard, type BudgetGuardAction, type BudgetRule } from '@/lib/ai/budget-guard';
import { createAdminNotification } from '@/lib/ai/notifications';
import { writeAdminAudit } from '@/lib/admin/audit';
import type { AIStage } from '@/lib/ai/types';

function actionNotification(action: BudgetGuardAction, stage: AIStage, usedPercent: number) {
  if (action.type === 'notify_critical') return { severity: 'critical' as const, title: 'AI budget critical', message: `AI budget used ${usedPercent.toFixed(1)}%.` };
  if (action.type === 'notify_warning') return { severity: 'warning' as const, title: 'AI budget warning', message: `AI budget used ${usedPercent.toFixed(1)}%.` };
  if (action.type === 'pause_ai') return { severity: 'critical' as const, title: 'AI paused by Budget Guard', message: `Budget Guard paused AI at ${usedPercent.toFixed(1)}% budget usage.` };
  if (action.type === 'disable_stage') return { severity: 'critical' as const, title: 'AI stage restricted', message: `Budget Guard disabled ${action.stage} at ${usedPercent.toFixed(1)}% budget usage.` };
  if (action.type === 'cost_saver') return { severity: 'warning' as const, title: 'Cost Saver active', message: `Budget Guard enabled Cost Saver for ${stage}.` };
  if (action.type === 'force_model') return { severity: 'warning' as const, title: 'Budget model override active', message: `Budget Guard forced ${action.model} for ${stage}.` };
  if (action.type === 'reduce_reasoning') return { severity: 'warning' as const, title: 'Reasoning reduced by Budget Guard', message: `Budget Guard reduced reasoning to ${action.effort} for ${stage}.` };
  return null;
}

export async function getBudgetGuardForStage(stage: AIStage, options?: { notify?: boolean }) {
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

    if (options?.notify !== false) {
      for (const action of evaluated.actions) {
        const notice = actionNotification(action, stage, budget.usedPercent);
        if (!notice) continue;
        try {
          const created = await createAdminNotification({
            ...notice,
            source: 'budget_guard',
            metadata: { action: action.type, stage, mode: evaluated.mode },
            dedupeKey: `budget:${budget.periodStart}:${stage}:${action.type}`,
          });
          if (created) {
            await writeAdminAudit({
              action: 'ai_budget_guard_triggered',
              subjectType: 'ai_budget_guard',
              subjectId: stage,
              newValue: { action, mode: evaluated.mode, budgetUsedPercent: budget.usedPercent },
            });
          }
        } catch {
          // Enforcement must not fail open because notification/audit persistence failed.
        }
      }
    }

    return { runtime, ...evaluated, routingPolicy: actionsToRoutingPolicy(evaluated.actions) };
  } catch {
    return { runtime, mode: 'normal' as const, actions: [], routingPolicy: {} };
  }
}
