create or replace function public.eligible_panel_verifiers(
  p_created_by uuid,
  p_panel_id uuid default null
)
returns table (id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select us.user_id
    from public.user_roles ur
    join public.user_statuses us on us.user_id = ur.user_id
    where ur.role = 'verifier'
      and us.status = 'active'
      and us.user_id is distinct from p_created_by
      and (
        p_panel_id is null
        or not exists (
          select 1
            from public.panel_members pm
            where pm.panel_id = p_panel_id
              and pm.member_id = us.user_id
        )
      );
$$;

revoke execute on function public.eligible_panel_verifiers(uuid, uuid) from public;
grant execute on function public.eligible_panel_verifiers(uuid, uuid) to service_role;
