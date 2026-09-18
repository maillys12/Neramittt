import { getServerSupabase } from '@/lib/supabase/server';
import type { BudgetSnapshot } from '@/lib/ai/types';

export function billingWindow(anchorDay: number, now: Date) {
  const day = Math.min(28, Math.max(1, Math.trunc(anchorDay)));
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const currentAnchor = new Date(Date.UTC(y, m, day, 0, 0, 0));
  const start = now >= currentAnchor ? currentAnchor : new Date(Date.UTC(y, m - 1, day, 0, 0, 0));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, day, 0, 0, 0));
  return { start, end };
}

export async function getBudgetSnapshot(now = new Date()): Promise<BudgetSnapshot> {
  const db = getServerSupabase();
  const { data: config, error } = await db.from('ai_budget_config')
    .select('monthly_budget_amount,currency,billing_period_anchor,enabled,usd_to_thb')
    .eq('id', 1).maybeSingle();
  if (error) throw error;
  const monthlyBudgetThb = Number(config?.monthly_budget_amount ?? 1000);
  const billingPeriodAnchor = Number(config?.billing_period_anchor ?? 1);
  const usdToThb = Number(config?.usd_to_thb ?? 34);
  const { start, end } = billingWindow(billingPeriodAnchor, now);
  const { data: rows, error: usageError } = await db.from('ai_usage_events')
    .select('estimated_cost_thb')
    .eq('execution_mode', 'production')
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString());
  if (usageError) throw usageError;
  const usedThb = (rows ?? []).reduce((sum, row) => sum + Number(row.estimated_cost_thb ?? 0), 0);
  const remainingThb = Math.max(0, monthlyBudgetThb - usedThb);
  const usedPercent = monthlyBudgetThb > 0 ? Math.min(999, usedThb / monthlyBudgetThb * 100) : 0;
  return {
    enabled: config?.enabled !== false,
    monthlyBudgetThb,
    billingPeriodAnchor,
    usedThb,
    remainingThb,
    usedPercent,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    usdToThb,
  };
}

export async function getCostWindows(now = new Date()) {
  const db = getServerSupabase();
  const startDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const { data, error } = await db.from('ai_usage_events')
    .select('created_at,estimated_cost_thb')
    .eq('execution_mode', 'production')
    .gte('created_at', startMonth.toISOString())
    .lte('created_at', now.toISOString());
  if (error) throw error;
  let dailyCostThb = 0;
  let monthlyCostThb = 0;
  for (const row of data ?? []) {
    const cost = Number(row.estimated_cost_thb ?? 0);
    monthlyCostThb += cost;
    if (new Date(row.created_at).getTime() >= startDay.getTime()) dailyCostThb += cost;
  }
  return { dailyCostThb, monthlyCostThb };
}
