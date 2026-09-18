-- Neramit member platform
-- 2026-09-19

create extension if not exists pgcrypto;

-- ---------- catalog / settings ----------
create table if not exists public.member_plans (
  code text primary key,
  name text not null,
  tier text not null check (tier in ('free','pro')),
  billing_interval text not null check (billing_interval in ('none','monthly','yearly')),
  price_thb numeric(12,2) not null default 0 check (price_thb >= 0),
  duration_days integer check (duration_days is null or duration_days > 0),
  monthly_credit_allocation numeric(14,4) not null default 0 check (monthly_credit_allocation >= 0),
  ai_entitlements jsonb not null default '{}'::jsonb,
  sellable boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.member_plans(code,name,tier,billing_interval,price_thb,duration_days,monthly_credit_allocation,ai_entitlements,sellable,sort_order)
values
  ('free','Free','free','none',0,null,10,'{"modelTier":"economy","reasoning":"limited","research":"limited"}'::jsonb,false,0),
  ('pro_monthly','Pro Monthly','pro','monthly',0,30,100,'{"modelTier":"premium","reasoning":"full","research":"full"}'::jsonb,false,10),
  ('pro_yearly','Pro Yearly','pro','yearly',0,365,100,'{"modelTier":"premium","reasoning":"full","research":"full"}'::jsonb,false,20)
on conflict (code) do nothing;

create table if not exists public.member_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.member_settings(key,value) values
  ('credit_conversion','{"creditsPerThb":1}'::jsonb),
  ('promptpay','{"mode":"static","staticQrPath":null,"promptpayId":null}'::jsonb)
on conflict (key) do nothing;

create table if not exists public.credit_packs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  credits numeric(14,4) not null check (credits > 0),
  price_thb numeric(12,2) not null check (price_thb >= 0),
  sellable boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('plan','credit_pack')),
  target_id text not null,
  promotional_price_thb numeric(12,2) not null check (promotional_price_thb >= 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotions_valid_window check (ends_at > starts_at)
);

-- ---------- member identity ----------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_path text,
  onboarding_completed boolean not null default false,
  deletion_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username is null or username ~ '^[a-z0-9_]{3,24}$'),
  constraint profiles_display_name_length check (display_name is null or char_length(display_name) between 1 and 80)
);

create table if not exists public.member_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_code text not null references public.member_plans(code),
  status text not null default 'active' check (status in ('active','paused','expired')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  paused_at timestamptz,
  paused_remaining_seconds bigint,
  next_plan_code text references public.member_plans(code),
  next_plan_start_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly_balance numeric(14,4) not null default 0 check (monthly_balance >= 0),
  purchased_balance numeric(14,4) not null default 0 check (purchased_balance >= 0),
  monthly_allocation numeric(14,4) not null default 0 check (monthly_allocation >= 0),
  monthly_reset_month date not null default date_trunc('month', current_date)::date,
  reserved_balance numeric(14,4) not null default 0 check (reserved_balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_ledger (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_type text not null check (wallet_type in ('monthly','purchased','reservation')),
  direction text not null check (direction in ('credit','debit','reserve','release')),
  amount numeric(14,4) not null check (amount >= 0),
  reason_code text not null,
  source_type text,
  source_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists credit_ledger_user_created_idx on public.credit_ledger(user_id, created_at desc);

create table if not exists public.member_ai_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id text not null,
  reserved_credits numeric(14,4) not null check (reserved_credits > 0),
  status text not null default 'reserved' check (status in ('reserved','settled','released')),
  actual_credits numeric(14,4),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  unique(user_id,request_id)
);

-- ---------- payments ----------
create table if not exists public.member_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('plan','credit_pack')),
  item_id text not null,
  item_name_snapshot text not null,
  normal_price_thb numeric(12,2) not null check (normal_price_thb >= 0),
  final_price_thb numeric(12,2) not null check (final_price_thb >= 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  admin_note text,
  approved_at timestamptz,
  approved_by text,
  requested_start_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists member_orders_user_created_idx on public.member_orders(user_id, created_at desc);

create table if not exists public.payment_submissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.member_orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  slip_path text not null,
  version integer not null default 1,
  status text not null default 'pending' check (status in ('pending','approved','rejected','superseded')),
  reviewed_at timestamptz,
  reviewed_by text,
  created_at timestamptz not null default now(),
  unique(order_id,version)
);

-- ---------- notifications / sessions ----------
create table if not exists public.member_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  read_at timestamptz,
  email_sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists member_notifications_user_created_idx on public.member_notifications(user_id, created_at desc);

create table if not exists public.member_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_token_hash text not null unique,
  device_label text,
  browser_label text,
  is_revoked boolean not null default false,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists member_sessions_user_idx on public.member_sessions(user_id, is_revoked, last_seen_at desc);

-- ---------- moderation ----------
create table if not exists public.suspensions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reason_public text not null,
  reason_internal text,
  status text not null default 'active' check (status in ('active','lifted')),
  suspended_at timestamptz not null default now(),
  lifted_at timestamptz,
  created_by text,
  lifted_by text
);
create unique index if not exists suspensions_one_active_per_user on public.suspensions(user_id) where status='active';

create table if not exists public.appeals (
  id uuid primary key default gen_random_uuid(),
  suspension_id uuid not null references public.suspensions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 5000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decision_note text,
  decided_at timestamptz,
  decided_by text,
  created_at timestamptz not null default now()
);
create index if not exists appeals_user_created_idx on public.appeals(user_id, created_at desc);

-- ---------- creations ----------
create table if not exists public.member_creations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_id uuid,
  title text not null default 'งานใหม่',
  pinned boolean not null default false,
  deleted_at timestamptz,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists member_creations_user_idx on public.member_creations(user_id, pinned desc, updated_at desc);

-- ---------- audit ----------
create table if not exists public.member_audit_logs (
  id bigserial primary key,
  actor_type text not null check (actor_type in ('member','admin','system')),
  actor_id text,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  before_value jsonb,
  after_value jsonb,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists member_audit_target_idx on public.member_audit_logs(target_user_id, created_at desc);

-- ---------- profile bootstrap ----------
create or replace function public.handle_new_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_free public.member_plans;
begin
  select * into v_free from public.member_plans where code='free';
  insert into public.profiles(user_id) values (new.id) on conflict do nothing;
  insert into public.member_subscriptions(user_id,plan_code,status,starts_at)
  values(new.id,'free','active',now()) on conflict do nothing;
  insert into public.credit_wallets(user_id,monthly_balance,monthly_allocation,monthly_reset_month)
  values(new.id,coalesce(v_free.monthly_credit_allocation,0),coalesce(v_free.monthly_credit_allocation,0),date_trunc('month',current_date)::date)
  on conflict do nothing;
  insert into public.credit_ledger(user_id,wallet_type,direction,amount,reason_code,source_type)
  values(new.id,'monthly','credit',coalesce(v_free.monthly_credit_allocation,0),'signup_free_allocation','system');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_member on auth.users;
create trigger on_auth_user_created_member
after insert on auth.users for each row execute function public.handle_new_member();

create or replace function public.prevent_username_change()
returns trigger language plpgsql as $$
begin
  if old.username is not null and new.username is distinct from old.username then
    raise exception 'USERNAME_IMMUTABLE';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_immutable_username on public.profiles;
create trigger profiles_immutable_username before update on public.profiles
for each row execute function public.prevent_username_change();

create or replace function public.create_member_profile(p_username text,p_display_name text)
returns public.profiles
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_profile public.profiles;
  v_username text := lower(trim(p_username));
  v_display_name text := trim(p_display_name);
begin
  if v_username !~ '^[a-z0-9_]{3,24}$' then raise exception 'USERNAME_INVALID'; end if;
  if char_length(v_display_name) < 1 or char_length(v_display_name) > 80 then raise exception 'DISPLAY_NAME_INVALID'; end if;
  select * into v_profile from public.profiles where user_id=auth.uid() for update;
  if v_profile.user_id is null then raise exception 'PROFILE_NOT_FOUND'; end if;
  if v_profile.username is not null then raise exception 'USERNAME_IMMUTABLE'; end if;
  update public.profiles set username=v_username,display_name=v_display_name,onboarding_completed=true,updated_at=now()
  where user_id=auth.uid() returning * into v_profile;
  return v_profile;
exception when unique_violation then raise exception 'USERNAME_TAKEN';
end;
$$;

-- ---------- credit functions ----------
create or replace function public.reset_member_monthly_credits(p_user_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_plan public.member_plans;
begin
  select p.* into v_plan
  from public.member_plans p
  join public.member_subscriptions s on s.plan_code=p.code
  where s.user_id=p_user_id;

  update public.credit_wallets
  set monthly_balance=coalesce(v_plan.monthly_credit_allocation,0),
      monthly_allocation=coalesce(v_plan.monthly_credit_allocation,0),
      monthly_reset_month=date_trunc('month',current_date)::date,
      updated_at=now()
  where user_id=p_user_id;

  insert into public.credit_ledger(user_id,wallet_type,direction,amount,reason_code,source_type)
  values(p_user_id,'monthly','credit',coalesce(v_plan.monthly_credit_allocation,0),'monthly_reset','system');
end;
$$;

create or replace function public.ensure_member_monthly_reset(p_user_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_month date; begin
  select monthly_reset_month into v_month from public.credit_wallets where user_id=p_user_id for update;
  if v_month is null or v_month < date_trunc('month',current_date)::date then
    perform public.reset_member_monthly_credits(p_user_id);
  end if;
end; $$;

create or replace function public.reserve_member_credits(p_user_id uuid,p_request_id text,p_amount numeric)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_wallet public.credit_wallets;
  v_id uuid;
  v_available numeric;
begin
  if p_amount <= 0 then raise exception 'CREDIT_RESERVATION_INVALID'; end if;
  perform public.ensure_member_monthly_reset(p_user_id);
  select * into v_wallet from public.credit_wallets where user_id=p_user_id for update;
  v_available := v_wallet.monthly_balance + v_wallet.purchased_balance - v_wallet.reserved_balance;
  if v_available < p_amount then raise exception 'CREDITS_EXHAUSTED'; end if;
  insert into public.member_ai_reservations(user_id,request_id,reserved_credits)
  values(p_user_id,p_request_id,p_amount) returning id into v_id;
  update public.credit_wallets set reserved_balance=reserved_balance+p_amount,updated_at=now() where user_id=p_user_id;
  insert into public.credit_ledger(user_id,wallet_type,direction,amount,reason_code,source_type,source_id)
  values(p_user_id,'reservation','reserve',p_amount,'ai_request_reserve','ai_request',p_request_id);
  return v_id;
end; $$;

create or replace function public.settle_member_credits(p_user_id uuid,p_request_id text,p_actual numeric)
returns table(monthly_balance numeric,purchased_balance numeric)
language plpgsql security definer set search_path=public as $$
declare
  v_res public.member_ai_reservations;
  v_wallet public.credit_wallets;
  v_monthly_debit numeric;
  v_purchased_debit numeric;
begin
  if p_actual < 0 then raise exception 'CREDIT_SETTLEMENT_INVALID'; end if;
  select * into v_res from public.member_ai_reservations
  where user_id=p_user_id and request_id=p_request_id and status='reserved' for update;
  if v_res.id is null then raise exception 'CREDIT_RESERVATION_NOT_FOUND'; end if;
  select * into v_wallet from public.credit_wallets where user_id=p_user_id for update;
  if p_actual > v_res.reserved_credits then raise exception 'CREDIT_SETTLEMENT_EXCEEDS_RESERVATION'; end if;

  v_monthly_debit := least(v_wallet.monthly_balance,p_actual);
  v_purchased_debit := greatest(0,p_actual-v_monthly_debit);

  update public.credit_wallets set
    monthly_balance=monthly_balance-v_monthly_debit,
    purchased_balance=purchased_balance-v_purchased_debit,
    reserved_balance=greatest(0,reserved_balance-v_res.reserved_credits),
    updated_at=now()
  where user_id=p_user_id;

  update public.member_ai_reservations set status='settled',actual_credits=p_actual,settled_at=now() where id=v_res.id;
  if v_monthly_debit > 0 then
    insert into public.credit_ledger(user_id,wallet_type,direction,amount,reason_code,source_type,source_id)
    values(p_user_id,'monthly','debit',v_monthly_debit,'ai_usage','ai_request',p_request_id);
  end if;
  if v_purchased_debit > 0 then
    insert into public.credit_ledger(user_id,wallet_type,direction,amount,reason_code,source_type,source_id)
    values(p_user_id,'purchased','debit',v_purchased_debit,'ai_usage','ai_request',p_request_id);
  end if;
  insert into public.credit_ledger(user_id,wallet_type,direction,amount,reason_code,source_type,source_id)
  values(p_user_id,'reservation','release',v_res.reserved_credits,'ai_request_settle','ai_request',p_request_id);

  return query select w.monthly_balance,w.purchased_balance from public.credit_wallets w where w.user_id=p_user_id;
end; $$;

create or replace function public.release_member_credits(p_user_id uuid,p_request_id text)
returns void language plpgsql security definer set search_path=public as $$
declare v_res public.member_ai_reservations; begin
  select * into v_res from public.member_ai_reservations
  where user_id=p_user_id and request_id=p_request_id and status='reserved' for update;
  if v_res.id is null then return; end if;
  update public.credit_wallets set reserved_balance=greatest(0,reserved_balance-v_res.reserved_credits),updated_at=now()
  where user_id=p_user_id;
  update public.member_ai_reservations set status='released',settled_at=now() where id=v_res.id;
  insert into public.credit_ledger(user_id,wallet_type,direction,amount,reason_code,source_type,source_id)
  values(p_user_id,'reservation','release',v_res.reserved_credits,'ai_request_release','ai_request',p_request_id);
end; $$;

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.member_subscriptions enable row level security;
alter table public.credit_wallets enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.member_ai_reservations enable row level security;
alter table public.member_plans enable row level security;
alter table public.credit_packs enable row level security;
alter table public.promotions enable row level security;
alter table public.member_orders enable row level security;
alter table public.payment_submissions enable row level security;
alter table public.member_notifications enable row level security;
alter table public.member_sessions enable row level security;
alter table public.suspensions enable row level security;
alter table public.appeals enable row level security;
alter table public.member_creations enable row level security;
alter table public.member_audit_logs enable row level security;
alter table public.member_settings enable row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles for select using(auth.uid()=user_id);
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update using(auth.uid()=user_id) with check(auth.uid()=user_id);

drop policy if exists subscription_self_select on public.member_subscriptions;
create policy subscription_self_select on public.member_subscriptions for select using(auth.uid()=user_id);
drop policy if exists wallet_self_select on public.credit_wallets;
create policy wallet_self_select on public.credit_wallets for select using(auth.uid()=user_id);

drop policy if exists plans_public_read on public.member_plans;
create policy plans_public_read on public.member_plans for select using(true);
drop policy if exists packs_public_read on public.credit_packs;
create policy packs_public_read on public.credit_packs for select using(sellable=true);
drop policy if exists promotions_public_read on public.promotions;
create policy promotions_public_read on public.promotions for select using(enabled=true);

drop policy if exists orders_self_select on public.member_orders;
create policy orders_self_select on public.member_orders for select using(auth.uid()=user_id);
drop policy if exists orders_self_insert on public.member_orders;
create policy orders_self_insert on public.member_orders for insert with check(auth.uid()=user_id);
drop policy if exists orders_self_cancel on public.member_orders;
create policy orders_self_cancel on public.member_orders for update using(auth.uid()=user_id and status='pending') with check(auth.uid()=user_id and status in ('pending','cancelled'));

drop policy if exists payment_self_select on public.payment_submissions;
create policy payment_self_select on public.payment_submissions for select using(auth.uid()=user_id);

drop policy if exists notifications_self_select on public.member_notifications;
create policy notifications_self_select on public.member_notifications for select using(auth.uid()=user_id);
drop policy if exists notifications_self_update on public.member_notifications;
create policy notifications_self_update on public.member_notifications for update using(auth.uid()=user_id) with check(auth.uid()=user_id);

drop policy if exists sessions_self_select on public.member_sessions;
create policy sessions_self_select on public.member_sessions for select using(auth.uid()=user_id);

drop policy if exists suspensions_self_select on public.suspensions;
create policy suspensions_self_select on public.suspensions for select using(auth.uid()=user_id);
drop policy if exists appeals_self_select on public.appeals;
create policy appeals_self_select on public.appeals for select using(auth.uid()=user_id);
drop policy if exists appeals_self_insert on public.appeals;
create policy appeals_self_insert on public.appeals for insert with check(auth.uid()=user_id);

drop policy if exists creations_self_all on public.member_creations;
create policy creations_self_all on public.member_creations for all using(auth.uid()=user_id) with check(auth.uid()=user_id);

-- member ledger / reservations / audit / settings remain server-only through service role.

-- ---------- private storage ----------
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('member-avatars','member-avatars',false,2097152,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=2097152,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

insert into storage.buckets(id,name,public)
values('member-slips','member-slips',false)
on conflict(id) do update set public=false;

drop policy if exists member_avatar_read on storage.objects;
create policy member_avatar_read on storage.objects for select to authenticated
using(bucket_id='member-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists member_avatar_insert on storage.objects;
create policy member_avatar_insert on storage.objects for insert to authenticated
with check(bucket_id='member-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists member_avatar_update on storage.objects;
create policy member_avatar_update on storage.objects for update to authenticated
using(bucket_id='member-avatars' and (storage.foldername(name))[1]=auth.uid()::text)
with check(bucket_id='member-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists member_avatar_delete on storage.objects;
create policy member_avatar_delete on storage.objects for delete to authenticated
using(bucket_id='member-avatars' and (storage.foldername(name))[1]=auth.uid()::text);

-- Slips are written/read through authenticated server routes; no direct client policies.

grant execute on function public.create_member_profile(text,text) to authenticated;
revoke all on function public.reserve_member_credits(uuid,text,numeric) from public,anon,authenticated;
revoke all on function public.settle_member_credits(uuid,text,numeric) from public,anon,authenticated;
revoke all on function public.release_member_credits(uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_member_credits(uuid,text,numeric) to service_role;
grant execute on function public.settle_member_credits(uuid,text,numeric) to service_role;
grant execute on function public.release_member_credits(uuid,text) to service_role;
