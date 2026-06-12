-- Granted roles a user holds. A user may hold several
-- roles at once (e.g. verifier + moderator).
create type public.app_role as enum ('verifier', 'moderator', 'admin');

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- True when the current user holds the given role. security definer so policy
-- checks elsewhere can read user_roles without tripping its own RLS.
create or replace function public.has_role(check_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid()) and role = check_role
  );
$$;

-- Row-level security policies. Role grants are admin-only and go through the
-- service client, so there are no insert/update/delete policies.
alter table public.user_roles enable row level security;

create policy "Users can view their own roles"
  on public.user_roles for select
  using (user_id = (select auth.uid()));
