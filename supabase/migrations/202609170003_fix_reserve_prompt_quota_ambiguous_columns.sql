create or replace function public.reserve_prompt_quota(p_device_id uuid, p_draft_id uuid, p_request_id text, p_daily_limit integer, p_variant_count integer)
returns table(job_id uuid, job_status text, is_existing boolean, used_count integer, reserved_count integer, daily_limit integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_device_status text;
  v_job public.prompt_jobs%rowtype;
  v_usage public.daily_usage%rowtype;
begin
  if p_request_id is null or length(trim(p_request_id)) < 8 then
    raise exception 'INVALID_REQUEST_ID';
  end if;
  if p_daily_limit < 1 then
    raise exception 'INVALID_DAILY_LIMIT';
  end if;
  if p_variant_count not between 1 and 3 then
    raise exception 'INVALID_VARIANT_COUNT';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_request_id));

  select d.status into v_device_status
  from public.devices d
  where d.id = p_device_id
  for update;

  if v_device_status is null then
    raise exception 'DEVICE_NOT_FOUND';
  end if;
  if v_device_status <> 'active' then
    raise exception 'DEVICE_SUSPENDED';
  end if;

  if not exists (
    select 1 from public.drafts d where d.id = p_draft_id and d.device_id = p_device_id
  ) then
    raise exception 'DRAFT_NOT_FOUND';
  end if;

  select j.* into v_job
  from public.prompt_jobs j
  where j.request_id = p_request_id;

  if found then
    if v_job.device_id <> p_device_id or v_job.draft_id <> p_draft_id then
      raise exception 'REQUEST_ID_CONFLICT';
    end if;

    insert into public.daily_usage(device_id, usage_date, used_count, reserved_count)
    values (p_device_id, current_date, 0, 0)
    on conflict (device_id, usage_date) do nothing;

    select du.* into v_usage
    from public.daily_usage du
    where du.device_id = p_device_id and du.usage_date = current_date;

    return query select v_job.id, v_job.status, true, v_usage.used_count, v_usage.reserved_count, p_daily_limit;
    return;
  end if;

  insert into public.daily_usage(device_id, usage_date, used_count, reserved_count)
  values (p_device_id, current_date, 0, 0)
  on conflict (device_id, usage_date) do nothing;

  select du.* into v_usage
  from public.daily_usage du
  where du.device_id = p_device_id and du.usage_date = current_date
  for update;

  if (v_usage.used_count + v_usage.reserved_count) >= p_daily_limit then
    raise exception 'QUOTA_EXCEEDED';
  end if;

  update public.daily_usage du
  set reserved_count = du.reserved_count + 1
  where du.device_id = p_device_id and du.usage_date = current_date
  returning du.* into v_usage;

  insert into public.prompt_jobs(request_id, draft_id, device_id, status, variant_count)
  values (p_request_id, p_draft_id, p_device_id, 'queued', p_variant_count)
  returning * into v_job;

  return query select v_job.id, v_job.status, false, v_usage.used_count, v_usage.reserved_count, p_daily_limit;
end;
$function$;
