create or replace function public.reassign_panel_member(
  p_panel_id uuid,
  p_member_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case_id uuid;
  v_created_by uuid;
  v_closed_at timestamptz;
  v_seat_id uuid;
  v_new_member uuid;
begin
  -- Lock panel so overlapping reassignments can't conflict.
  select case_id, closed_at
    into v_case_id, v_closed_at
    from public.review_panels
    where id = p_panel_id
    for update;
  if not found then
    raise exception 'Review panel not found' using errcode = 'no_data_found';
  end if;
  if v_closed_at is not null then
   raise exception 'Cannot reassign a seat on a closed panel' using errcode = 'check_violation';
  end if; 
  select created_by into v_created_by
    from public.review_cases
    where id = v_case_id;
  select id into v_seat_id
    from public.panel_members
    where panel_id = p_panel_id
      and member_id = p_member_id
    for update;
  if not found then
    raise exception 'Selected member is not on selected panel.' using errcode = 'no_data_found';
  end if;
  -- replacement conditions: active, not author, not already on panel (which includes person being removed)
  select ur.user_id into v_new_member
    from public.user_roles ur
    join public.user_statuses us on us.user_id = ur.user_id
    where ur.role = 'verifier'
      and us.status = 'active'
      and ur.user_id is distinct from v_created_by
      and not exists (
        select 1 from public.panel_members pm
        where pm.panel_id = p_panel_id
          and pm.member_id = ur.user_id
      )
    order by random()
    limit 1;
  if v_new_member is null then
    return null;
  end if;
  -- remove decision from person being removed from panel
  delete from public.review_decisions
    where panel_member_id = v_seat_id;
  update public.panel_members
    set member_id = v_new_member,
      status = 'assigned',
      assigned_at = now()
    where id = v_seat_id;
  return v_new_member;
end;
$$;
grant execute on function public.reassign_panel_member(uuid, uuid) to service_role;
