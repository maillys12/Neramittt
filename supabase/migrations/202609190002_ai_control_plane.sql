create table if not exists public.ai_runtime_config (
  id smallint primary key default 1 check (id = 1),
  auto_routing_enabled boolean not null default true,
  safe_mode boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.ai_runtime_config enable row level security;
insert into public.ai_runtime_config(id) values (1)
on conflict (id) do nothing;

create table if not exists public.ai_stage_config (
  stage text primary key check (stage in ('requirement','research','creative_director','final_prompt','repair')),
  mode text not null default 'auto' check (mode in ('auto','manual')),
  model_override text,
  fallback_model text not null default 'gpt-5.6-luna',
  reasoning_effort text not null default 'low' check (reasoning_effort in ('none','low','medium','high','xhigh','max')),
  max_output_tokens integer not null check (max_output_tokens between 128 and 128000),
  updated_at timestamptz not null default now()
);
alter table public.ai_stage_config enable row level security;

insert into public.ai_stage_config(stage, mode, fallback_model, reasoning_effort, max_output_tokens)
values
  ('requirement','auto','gpt-5.6-luna','low',1400),
  ('research','auto','gpt-5.6-luna','low',1400),
  ('creative_director','auto','gpt-5.6-luna','low',2600),
  ('final_prompt','auto','gpt-5.6-luna','low',2600),
  ('repair','auto','gpt-5.6-luna','low',1800)
on conflict (stage) do nothing;

create table if not exists public.ai_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  prompt_type text not null check (prompt_type in ('system','creative_director')),
  version integer not null,
  status text not null check (status in ('draft','published','archived')),
  content text not null check (length(content) between 1 and 50000),
  change_note text,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique(prompt_type, version)
);
alter table public.ai_prompt_versions enable row level security;
create unique index if not exists ai_prompt_versions_one_published
  on public.ai_prompt_versions(prompt_type)
  where status = 'published';

create or replace function public.publish_ai_prompt(p_prompt_type text, p_draft_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_prompt_type not in ('system','creative_director') then
    raise exception 'PROMPT_TYPE_INVALID';
  end if;

  perform 1 from public.ai_prompt_versions
  where id = p_draft_id and prompt_type = p_prompt_type and status = 'draft'
  for update;
  if not found then raise exception 'PROMPT_DRAFT_NOT_FOUND'; end if;

  update public.ai_prompt_versions
  set status = 'archived'
  where prompt_type = p_prompt_type and status = 'published';

  update public.ai_prompt_versions
  set status = 'published', published_at = now()
  where id = p_draft_id
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.rollback_ai_prompt(p_prompt_type text, p_version integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_content text;
  v_note text;
  v_next integer;
  v_id uuid;
begin
  select content, change_note into v_content, v_note
  from public.ai_prompt_versions
  where prompt_type = p_prompt_type and version = p_version
  limit 1;

  if v_content is null then raise exception 'PROMPT_VERSION_NOT_FOUND'; end if;

  select coalesce(max(version),0)+1 into v_next
  from public.ai_prompt_versions
  where prompt_type = p_prompt_type;

  update public.ai_prompt_versions set status='archived'
  where prompt_type=p_prompt_type and status='published';

  insert into public.ai_prompt_versions(prompt_type, version, status, content, change_note, published_at)
  values (p_prompt_type, v_next, 'published', v_content, concat('Rollback to v', p_version, coalesce(' — '||v_note,'')), now())
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.publish_ai_prompt(text, uuid) from public, anon, authenticated;
revoke all on function public.rollback_ai_prompt(text, integer) from public, anon, authenticated;
grant execute on function public.publish_ai_prompt(text, uuid) to service_role;
grant execute on function public.rollback_ai_prompt(text, integer) to service_role;
