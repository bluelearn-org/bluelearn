-- Direct Supabase writes must enforce suspension, not just the API or editor.
-- Table-wide UPDATE was re-granted for dashboard moderation; statuses now own
-- suspension, so ordinary profile edits must return to column-level grants.
revoke update on public.profiles from public, anon, authenticated;
grant update (username, display_name, bio) on public.profiles to authenticated;

create or replace function public.sync_profile_suspension()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
    set is_suspended = (new.status = 'suspended')
    where id = new.user_id
      and is_suspended is distinct from (new.status = 'suspended');
  return new;
end;
$$;

revoke execute on function public.sync_profile_suspension() from public, anon, authenticated;

-- The status write and its profile mirror commit or fail together.
create trigger user_statuses_sync_profile_suspension
  after insert or update on public.user_statuses
  for each row execute function public.sync_profile_suspension();

update public.profiles p
  set is_suspended = (s.status = 'suspended')
  from public.user_statuses s
  where s.user_id = p.id
    and p.is_suspended is distinct from (s.status = 'suspended');

create or replace function public.is_active_guide_author()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and not is_suspended
  );
$$;

-- Restrictive command policies compose with existing ownership/status checks.
-- Never use FOR ALL here: SELECT, including existing drafts, stays unchanged.
-- Objectives, votes, reviews, and security-definer publishing remain separate.
create policy "Active authors can insert guide bases"
  on public.guide_bases as restrictive for insert to authenticated
  with check ((select public.is_active_guide_author()));

create policy "Active authors can update guide bases"
  on public.guide_bases as restrictive for update to authenticated
  using ((select public.is_active_guide_author()))
  with check ((select public.is_active_guide_author()));

create policy "Active authors can insert guides"
  on public.guides as restrictive for insert to authenticated
  with check ((select public.is_active_guide_author()));

create policy "Active authors can update guides"
  on public.guides as restrictive for update to authenticated
  using ((select public.is_active_guide_author()))
  with check ((select public.is_active_guide_author()));

create policy "Active authors can insert guide revisions"
  on public.guide_revisions as restrictive for insert to authenticated
  with check ((select public.is_active_guide_author()));

create policy "Active authors can update guide revisions"
  on public.guide_revisions as restrictive for update to authenticated
  using ((select public.is_active_guide_author()))
  with check ((select public.is_active_guide_author()));

-- Child writes can bypass parent mutation policies when called directly.

create policy "Active authors can insert revision tags"
  on public.guide_revision_subjects as restrictive for insert to authenticated
  with check ((select public.is_active_guide_author()));

create policy "Active authors can delete revision tags"
  on public.guide_revision_subjects as restrictive for delete to authenticated
  using ((select public.is_active_guide_author()));

create policy "Active authors can insert prerequisites"
  on public.guide_edges as restrictive for insert to authenticated
  with check ((select public.is_active_guide_author()));

create policy "Active authors can delete prerequisites"
  on public.guide_edges as restrictive for delete to authenticated
  using ((select public.is_active_guide_author()));

create policy "Active authors can suspend prerequisites"
  on public.guide_edges as restrictive for update to authenticated
  using ((select public.is_active_guide_author()))
  with check ((select public.is_active_guide_author()));

-- Live databases can apply the requests rename before this older migration.
do $$
declare
  requests_table text := coalesce(
    to_regclass('public.requests')::text, 'public.todo_prerequisites'
  );
  claims_table text := coalesce(
    to_regclass('public.request_claims')::text, 'public.todo_claims'
  );
begin
  execute format(
    'create policy "Active authors can insert todos" on %s as restrictive for insert to authenticated
     with check ((select public.is_active_guide_author()))',
    requests_table
  );
  execute format(
    'create policy "Active authors can delete todos" on %s as restrictive for delete to authenticated
     using ((select public.is_active_guide_author()))',
    requests_table
  );
  execute format(
    'create policy "Active authors can insert todo claims" on %s as restrictive for insert to authenticated
     with check ((select public.is_active_guide_author()))',
    claims_table
  );
  execute format(
    'create policy "Active authors can delete todo claims" on %s as restrictive for delete to authenticated
     using ((select public.is_active_guide_author()))',
    claims_table
  );
end;
$$;

create policy "Active authors can insert disclaimers"
  on public.guide_disclaimers as restrictive for insert to authenticated
  with check ((select public.is_active_guide_author()));

create policy "Active authors can update disclaimers"
  on public.guide_disclaimers as restrictive for update to authenticated
  using ((select public.is_active_guide_author()))
  with check ((select public.is_active_guide_author()));

create policy "Active authors can delete disclaimers"
  on public.guide_disclaimers as restrictive for delete to authenticated
  using ((select public.is_active_guide_author()));

create policy "Active authors can insert revision assets"
  on public.revision_assets as restrictive for insert to authenticated
  with check ((select public.is_active_guide_author()));

create policy "Active authors can delete revision assets"
  on public.revision_assets as restrictive for delete to authenticated
  using ((select public.is_active_guide_author()));

create policy "Active authors can insert guide submission links"
  on public.guide_review_cases as restrictive for insert to authenticated
  with check ((select public.is_active_guide_author()));

-- Only opening a guide submission is authoring; other case types and all
-- panel decisions retain their existing permissions.
create policy "Active authors can open guide submission cases"
  on public.review_cases as restrictive for insert to authenticated
  with check (
    case_type not in ('guide_publish', 'guide_edit', 'official_publish', 'official_edit')
    or (select public.is_active_guide_author())
  );

-- Public promotion uses fixed governance values. Trusted service work can still
-- call the original configurable function when maintenance needs different values.
alter function public.promote_canonical_guide(
  uuid, double precision, double precision, integer
) rename to promote_canonical_guide_with_thresholds;

revoke execute on function public.promote_canonical_guide_with_thresholds(
  uuid, double precision, double precision, integer
) from public, anon, authenticated;
grant execute on function public.promote_canonical_guide_with_thresholds(
  uuid, double precision, double precision, integer
) to service_role;

create or replace function public.promote_canonical_guide(
  p_guide_base_id uuid,
  p_z double precision default 1.96,
  p_margin double precision default 0.05,
  p_min_votes integer default 5
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() = 'authenticated'
    and (
      p_z is distinct from 1.96::double precision
      or p_margin is distinct from 0.05::double precision
      or p_min_votes is distinct from 5
    )
  then
    raise exception 'Custom canonical promotion thresholds are not permitted'
      using errcode = '42501';
  end if;

  return public.promote_canonical_guide_with_thresholds(
    p_guide_base_id,
    p_z,
    p_margin,
    p_min_votes
  );
end;
$$;

revoke execute on function public.promote_canonical_guide(
  uuid, double precision, double precision, integer
) from public, anon;
grant execute on function public.promote_canonical_guide(
  uuid, double precision, double precision, integer
) to authenticated, service_role;