create table if not exists public.ai_budget_rules (
  id uuid primary key default gen_random_uuid(),
  enabled boolean not null default true,
  priority integer not null default 100,
  condition_metric text not null check (condition_metric in ('budget_used_percent','budget_remaining_thb','daily_cost_thb','monthly_cost_thb')),
  operator text not null check (operator in ('gte','lte','gt','lt')),
  threshold numeric(18,6) not null,
  action text not null check (action in ('notify_warning','notify_critical','cost_saver','reduce_reasoning','force_model','disable_stage','pause_ai')),
  action_config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.ai_budget_rules enable row level security;
create index if not exists ai_budget_rules_priority_idx
  on public.ai_budget_rules(enabled, priority asc);

insert into public.ai_budget_rules(enabled, priority, condition_metric, operator, threshold, action, action_config)
values
  (false, 100, 'budget_used_percent', 'gte', 70, 'notify_warning', '{}'),
  (false, 200, 'budget_used_percent', 'gte', 85, 'cost_saver', '{}'),
  (false, 300, 'budget_used_percent', 'gte', 95, 'notify_critical', '{}')
on conflict do nothing;
