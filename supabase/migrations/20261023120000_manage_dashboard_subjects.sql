create policy "Lead verifiers can view draft subjects"
  on public.subjects for select to authenticated
  using (public.has_role('lead-verifier'));

-- All revisions must move together, including drafts and past revisions that
-- are hidden from the caller by RLS. Permission is checked before any writes.
create function public.manage_subjects(
  p_subject_ids uuid[], p_target_id uuid, p_name text, p_summary text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  locked_count integer;
  target_status public.subject_status;
begin
  if (select auth.uid()) is null or not (
    public.has_role('admin') or public.has_role('lead-verifier')
  ) then
    raise insufficient_privilege using message = 'Only admins and lead verifiers can manage subjects';
  end if;

  if p_subject_ids is null or cardinality(p_subject_ids) not between 1 and 100
    or p_target_id is null or not (p_target_id = any(p_subject_ids))
    or cardinality(p_subject_ids) <> (select count(distinct id) from unnest(p_subject_ids) as ids(id))
    or p_name is null or char_length(btrim(p_name)) not between 3 and 50
    or char_length(btrim(p_summary)) > 500 then
    raise check_violation using message = 'Invalid subject selection or details';
  end if;

  -- A consistent lock order serializes overlapping merges and prevents a new
  -- foreign-key reference from arriving while its subject is being removed.
  perform id from public.subjects
    where id = any(p_subject_ids) order by id for update;
  get diagnostics locked_count = row_count;
  if locked_count <> cardinality(p_subject_ids) then
    raise no_data_found using message = 'A selected subject is no longer available';
  end if;

  select status into target_status from public.subjects where id = p_target_id;
  if target_status = 'draft' and exists (
    select 1 from public.subjects where id = any(p_subject_ids) and status = 'published'
  ) then
    raise check_violation using message = 'Keep a published subject when merging published subjects';
  end if;

  if cardinality(p_subject_ids) > 1 then
    insert into public.guide_revision_subjects (guide_revision_id, subject_id)
      select distinct guide_revision_id, p_target_id
      from public.guide_revision_subjects
      where subject_id = any(p_subject_ids) and subject_id <> p_target_id
      on conflict do nothing;
    insert into public.objective_revision_subjects (objective_revision_id, subject_id)
      select distinct objective_revision_id, p_target_id
      from public.objective_revision_subjects
      where subject_id = any(p_subject_ids) and subject_id <> p_target_id
      on conflict do nothing;

    -- Only duplicate subjects are removed. Cascades remove their old tags,
    -- never the guides or objectives those tags belong to.
    delete from public.subjects where id = any(p_subject_ids) and id <> p_target_id;
  end if;

  -- Keep the destination's id, slug, status and creation date stable.
  update public.subjects set name = btrim(p_name), summary = nullif(btrim(p_summary), '')
    where id = p_target_id;
end;
$$;

revoke execute on function public.manage_subjects(uuid[], uuid, text, text) from public, anon;
grant execute on function public.manage_subjects(uuid[], uuid, text, text) to authenticated;
