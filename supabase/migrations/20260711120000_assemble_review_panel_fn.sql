-- Seat a random odd-sized verifier panel on a pending case. Called per pending case
-- by the assembly cron trigger. Returns the new panel id or null when it declined to
-- seat (case not pending, already has an open panel, or the eligible pool is too
-- small), so the caller can retry the case on a later tick.
create or replace function public.assemble_review_panel(
  p_case_id uuid,
  p_policy_default integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.case_status;
  v_created_by uuid;
  v_pool_size integer;
  v_target integer;
  v_panel_id uuid;
begin
  -- Lock the case row so two overlapping cron ticks cannot both seat it.
  select status, created_by
    into v_status, v_created_by
    from public.review_cases
    where id = p_case_id
    for update;

  if not found then
    raise exception 'Review case not found' using errcode = 'no_data_found';
  end if;

  if v_status <> 'pending' then
    return null;
  end if;
  if exists (
    select 1 from public.review_panels
    where case_id = p_case_id and closed_at is null
  ) then
    return null;
  end if;

  -- Eligible pool: verifiers who are not suspended and not the case author.
  select count(*)
    into v_pool_size
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.role = 'verifier'
      and p.is_suspended = false
      and p.id is distinct from v_created_by;

  -- A pool too small to seat the minimum leaves the case pending for retry.
  v_target := least(p_policy_default, v_pool_size);
  if v_target % 2 = 0 then
    v_target := v_target - 1;
  end if;
  if v_target < 3 then
    return null;
  end if;

  insert into public.review_panels (case_id, target_seat_count)
    values (p_case_id, v_target)
    returning id into v_panel_id;

  insert into public.panel_members (panel_id, member_id)
  select v_panel_id, p.id
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.role = 'verifier'
      and p.is_suspended = false
      and p.id is distinct from v_created_by
    order by random()
    limit v_target;

  update public.review_cases
    set status = 'in_review'
    where id = p_case_id;

  return v_panel_id;
end;
$$;

grant execute on function public.assemble_review_panel(uuid, integer) to service_role;
