-- Self-service role applications: a member asks for verifier or moderator and
-- an admin decides from the dashboard. Until now the only way into either role
-- was to find a maintainer; see docs/database-schema.md ("role_applications").

create type public.role_application_status as enum (
  'pending',
  'approved',
  'rejected'
);

create table public.role_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  status public.role_application_status not null default 'pending',
  statement text,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  -- admin, curator and official stay granted directly by an admin.
  constraint role_applications_role_appliable
    check (role in ('verifier', 'moderator')),
  constraint role_applications_statement_length
    check (statement is null or length(statement) between 1 and 2000),
  -- A decision stamps its time; a pending application has none.
  constraint role_applications_decided_when_closed
    check ((status = 'pending') = (decided_at is null))
);

create index role_applications_user_id_idx
  on public.role_applications (user_id);
create index role_applications_status_created_at_idx
  on public.role_applications (status, created_at);

-- One open application per role per member.
create unique index role_applications_one_pending_per_role
  on public.role_applications (user_id, role)
  where status = 'pending';

alter table public.role_applications enable row level security;

create policy "Members can view their own role applications"
  on public.role_applications for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Admins can view all role applications"
  on public.role_applications for select to authenticated
  using (public.has_role('admin'::public.app_role));

-- Applying is the only direct write. Decisions go through
-- decide_role_application so the role grant lands in the same transaction.
create policy "Active members can apply for a role they do not hold"
  on public.role_applications for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and decided_by is null
    and not public.has_role(role_applications.role)
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and not p.is_suspended
    )
  );

-- Applications with the applicant's handle, for the admin dashboard table.
-- security_invoker keeps the table's RLS in force: admins see every row, a
-- member only their own.
create view public.dashboard_role_applications with (security_invoker = on) as
select
  ra.id,
  ra.user_id,
  p.username,
  ra.role,
  ra.status,
  ra.statement,
  ra.created_at,
  ra.decided_at,
  dp.username as decided_by
from public.role_applications ra
join public.profiles p on p.id = ra.user_id
left join public.profiles dp on dp.id = ra.decided_by;

grant select on public.dashboard_role_applications to authenticated, service_role;

-- Admin decision. Approval grants the role in the same transaction, so an
-- approved application never exists without its user_roles row.
create or replace function public.decide_role_application(
  p_application_id uuid,
  p_decision public.role_application_status
)
returns public.role_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.role_applications;
begin
  if not public.has_role('admin'::public.app_role) then
    raise exception 'Only admins can decide role applications'
      using errcode = '42501';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'A decision is approved or rejected'
      using errcode = '22023';
  end if;

  update public.role_applications
    set status = p_decision,
        decided_at = now(),
        decided_by = (select auth.uid())
    where id = p_application_id and status = 'pending'
    returning * into v_application;

  if not found then
    raise exception 'Role application not found or already decided'
      using errcode = 'P0002';
  end if;

  if p_decision = 'approved' then
    insert into public.user_roles (user_id, role)
      values (v_application.user_id, v_application.role)
      on conflict do nothing;
  end if;

  return v_application;
end;
$$;

revoke execute on function public.decide_role_application(
  uuid, public.role_application_status
) from public, anon;
grant execute on function public.decide_role_application(
  uuid, public.role_application_status
) to authenticated, service_role;

-- A role granted straight from the Roles table settles any pending application
-- for it, so the dashboard never lists a request for a role the member holds.
create or replace function public.resolve_role_applications_on_grant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.role_applications
    set status = 'approved',
        decided_at = now(),
        decided_by = (select auth.uid())
    where user_id = new.user_id
      and role = new.role
      and status = 'pending';
  return new;
end;
$$;

revoke execute on function public.resolve_role_applications_on_grant()
  from public, anon, authenticated;

create trigger user_roles_resolve_role_applications
  after insert on public.user_roles
  for each row execute function public.resolve_role_applications_on_grant();
