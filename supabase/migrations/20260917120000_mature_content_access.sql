-- Birth dates must not live in the publicly readable profiles table.
create table public.account_details (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  date_of_birth date,
  constraint date_of_birth_not_future check (date_of_birth <= current_date)
);
alter table public.account_details enable row level security;
revoke all on public.account_details from anon, authenticated;
grant select, insert, update on public.account_details to authenticated;
create policy "Users can read their account details"
  on public.account_details for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Users can insert their account details"
  on public.account_details for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Users can update their account details"
  on public.account_details for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Protect history, diffs and direct PostgREST reads as well as the reader.
-- Existing permissive policies still determine publication/ownership.
create function public.can_read_mature_guide(p_guide_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select not exists (
    select 1 from public.guides g
    join public.guide_disclaimers gd on gd.guide_base_id = g.guide_base_id
    join public.disclaimers d on d.id = gd.disclaimer_id
    where g.id = p_guide_id and d.slug = 'mature'
  ) or exists (
    select 1 from public.account_details a
    where a.user_id = auth.uid() and a.date_of_birth is not null
      and extract(year from age((now() at time zone 'UTC')::date, a.date_of_birth)) >= 18
  );
$$;
revoke all on function public.can_read_mature_guide(uuid) from public;
grant execute on function public.can_read_mature_guide(uuid) to anon, authenticated;
create policy "Mature revisions require an adult account"
  on public.guide_revisions as restrictive for select to anon, authenticated
  using (public.can_read_mature_guide(guide_id));

-- Expose only the current published header when RLS withholds the revision.
create function public.get_guide_reader_metadata(p_guide_id uuid)
returns table (id uuid, title text, summary text, word_count integer, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.title, r.summary, r.word_count, r.created_at
  from public.guides g
  join public.guide_bases b on b.id = g.guide_base_id
  join public.guide_revisions r on r.id = g.current_revision_id
  where g.id = p_guide_id and g.status = 'published'
    and b.status = 'published' and r.status = 'submitted'
    and r.approved_at is not null;
$$;
revoke all on function public.get_guide_reader_metadata(uuid) from public;
grant execute on function public.get_guide_reader_metadata(uuid) to anon, authenticated;

-- A reader must not be able to remove the flag to bypass the age gate. Once
-- published, removing/reassigning a mature warning is a moderation action.
create function public.protect_mature_disclaimer()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if auth.role() = 'authenticated'
     and exists (select 1 from public.disclaimers where id = old.disclaimer_id and slug = 'mature')
     and exists (select 1 from public.guide_bases where id = old.guide_base_id and status <> 'draft')
     and not (public.has_role('moderator') or public.has_role('admin')) then
    raise exception 'Only moderators can remove a published mature disclaimer' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.protect_mature_disclaimer() from public;
create trigger protect_mature_disclaimer
  before delete or update on public.guide_disclaimers
  for each row execute function public.protect_mature_disclaimer();

-- Keep published cards discoverable without granting access to revision bodies.
create or replace view public.published_guides with (security_invoker = on) as
select gb.id, gb.slug as base_slug, gb.knowledge_type, gb.status, gb.created_at,
  g.id as guide_id, g.slug as guide_slug, g.author_id,
  r.id as revision_id, r.title, r.summary, r.word_count,
  (select coalesce(array_agg(grs.subject_id), '{}'::uuid[])
   from public.guide_revision_subjects grs where grs.guide_revision_id = r.id) as subject_ids,
  gb.is_official
from public.guide_bases gb
join public.guides g on g.id = gb.canonical_guide_id
cross join lateral public.get_guide_reader_metadata(g.id) r
where gb.status = 'published';
