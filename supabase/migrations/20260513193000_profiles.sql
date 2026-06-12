create table public.profiles (
  -- on delete restrict: deleting an auth user never destroys the
  -- profile and everything hanging off it (votes, roles). Account deletion is
  -- a deliberate app-level flow: anonymize/delete the profile row first, then
  -- delete the auth user.
  id uuid primary key references auth.users (id) on delete restrict,
  username text not null unique,
  display_name text,
  bio text,
  is_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_nonempty check (char_length(trim(username)) > 0)
);

-- Usernames are URL handles: "Username" and "username" must not coexist.
create unique index profiles_username_lower_idx on public.profiles (lower(username));

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- A failure here aborts the auth.users insert itself (signup dies), so the
-- function must always produce a valid, unique username: fall back to an
-- id-derived handle when metadata is missing or the requested name is taken.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_username text;
begin
  requested_username := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
  if requested_username is null then
    requested_username := 'user-' || left(replace(new.id::text, '-', ''), 8);
  end if;

  begin
    insert into public.profiles (id, username)
    values (new.id, requested_username);
  exception when unique_violation then
    insert into public.profiles (id, username)
    values (new.id, requested_username || '-' || left(replace(new.id::text, '-', ''), 6));
  end;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row-level security policies
alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Column-level lockdown beneath RLS: a policy with check only sees the new
-- row, so it cannot stop a user setting is_suspended back to false. Revoking
-- table-wide update and granting only the self-editable columns leaves
-- is_suspended (and id / timestamps) writable solely by the service client.
revoke update on public.profiles from authenticated, anon;
grant update (username, display_name, bio) on public.profiles to authenticated;
