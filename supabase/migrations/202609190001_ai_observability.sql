-- AI observability/control tables are server-only. RLS is enabled with no public policies.
-- Usage rows are append-only from trusted server code.
create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  request_id text not null,
  execution_mode text not null check (execution_mode in ('production','draft_test')),
  stage text not null check (stage in ('requirement','research','creative_director','final_prompt','repair')),
  model text not null,
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  cached_tokens bigint not null default 0 check (cached_tokens >= 0),
  tool_calls integer not null default 0 check (tool_calls >= 0),
  estimated_cost_usd numeric(18,8) not null default 0 check (estimated_cost_usd >= 0),
  estimated_cost_thb numeric(18,6) not null default 0 check (estimated_cost_thb >= 0),
  exchange_rate_snapshot numeric(18,6) not null default 0 check (exchange_rate_snapshot >= 0),
  pricing_version text not null,
  duration_ms integer not null default 0 check (duration_ms >= 0),
  status text not null check (status in ('success','error')),
  error_code text,
  retry_index integer not null default 0 check (retry_index >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.ai_usage_events enable row level security;

create index if not exists ai_usage_events_created_at_idx on public.ai_usage_events(created_at desc);
create index if not exists ai_usage_events_stage_created_idx on public.ai_usage_events(stage, created_at desc);
create index if not exists ai_usage_events_model_created_idx on public.ai_usage_events(model, created_at desc);
create index if not exists ai_usage_events_request_idx on public.ai_usage_events(request_id);
create index if not exists ai_usage_events_mode_created_idx on public.ai_usage_events(execution_mode, created_at desc);

create table if not exists public.ai_budget_config (
  id smallint primary key default 1 check (id = 1),
  monthly_budget_amount numeric(18,2) not null default 1000 check (monthly_budget_amount >= 0),
  currency text not null default 'THB' check (currency = 'THB'),
  billing_period_anchor smallint not null default 1 check (billing_period_anchor between 1 and 28),
  enabled boolean not null default true,
  usd_to_thb numeric(18,6) not null default 34 check (usd_to_thb > 0),
  updated_at timestamptz not null default now()
);
alter table public.ai_budget_config enable row level security;

insert into public.ai_budget_config(id) values (1)
on conflict (id) do nothing;

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  severity text not null check (severity in ('info','warning','critical')),
  source text not null,
  title text not null,
  message text not null,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_notifications enable row level security;
create index if not exists admin_notifications_unread_idx
  on public.admin_notifications(created_at desc)
  where read_at is null;
