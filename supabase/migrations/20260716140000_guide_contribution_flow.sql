-- Subjects added inline while drafting a guide need to be reviewed before they
-- show up publicly, so they get a draft/published status like guides do.
create type public.subject_status as enum ('draft', 'published');
alter table public.subjects
  add column status public.subject_status not null default 'draft';

update public.subjects set status = 'published';
drop policy "Subjects are viewable by everyone" on public.subjects;
create policy "Published subjects are viewable by everyone"
  on public.subjects for select
  using (
    status = 'published'
    or creator_id = (select auth.uid())
    or public.has_role('moderator')
    or public.has_role('admin')
  );

create policy "Authors can remove edges on their draft topics"
  on public.guide_edges for delete
  to authenticated
  using (
    exists (
      select 1
      from public.guides g
      join public.guide_bases b on b.id = g.guide_base_id
      where g.guide_base_id in (from_guide_base_id, to_guide_base_id)
        and g.author_id = (select auth.uid())
        and b.status = 'draft'
    )
  );

create policy "Authors can remove todos on their draft topics"
  on public.todo_prerequisites for delete
  to authenticated
  using (
    exists (
      select 1
      from public.guides g
      join public.guide_bases b on b.id = g.guide_base_id
      where g.guide_base_id = dependent_guide_base_id
        and g.author_id = (select auth.uid())
        and b.status = 'draft'
    )
  );

-- A revision can only be submitted once it's complete: title, summary, body and
-- at least one tag (prereqs and todos are optional).
create or replace function public.submit_guide_revision(p_revision_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_guide_id uuid;
  v_current_revision_id uuid;
  v_case_type public.case_type;
  v_case_id uuid;
  v_title text;
  v_summary text;
  v_body text;
  v_tag_count integer;
begin
  -- RLS confines this to the caller's own draft, so zero rows means the revision
  -- is missing, not theirs, or already submitted.
  select title, summary, body into v_title, v_summary, v_body
    from public.guide_revisions
    where id = p_revision_id and status = 'draft';

  if not found then
    raise exception 'Revision not found or not an editable draft'
      using errcode = 'no_data_found';
  end if;

  select count(*) into v_tag_count
    from public.guide_revision_subjects
    where guide_revision_id = p_revision_id;

  if coalesce(btrim(v_title), '') = ''
     or coalesce(btrim(v_summary), '') = ''
     or coalesce(btrim(v_body), '') = ''
     or v_tag_count = 0 then
    raise exception 'Revision is missing a title, summary, body, or tag'
      using errcode = 'check_violation';
  end if;

  update public.guide_revisions
    set status = 'submitted'
    where id = p_revision_id
    returning guide_id into v_guide_id;

  select current_revision_id into v_current_revision_id
    from public.guides where id = v_guide_id;

  -- No live revision yet means this is the first publish (otherwise it's a revision).
  v_case_type := case
    when v_current_revision_id is null then 'guide_publish'
    else 'guide_edit'
  end;

  insert into public.review_cases (case_type, created_by)
    values (v_case_type, auth.uid())
    returning id into v_case_id;

  insert into public.guide_review_cases (case_id, guide_revision_id)
    values (v_case_id, p_revision_id);

  return v_case_id;
end;
$$;

-- Same as old close_review_panel except publishing a guide now also flips the
-- subjects that revision tagged from draft to published.
create or replace function public.close_review_panel(p_case_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_panel_id uuid;
  v_target integer;
  v_case_type public.case_type;
  v_majority integer;
  v_approve integer;
  v_reject integer;
  v_outcome public.review_outcome;
  v_revision_id uuid;
  v_guide_id uuid;
  v_base_id uuid;
  v_title text;
  v_slug_base text;
  v_slug text;
  v_suffix integer;
begin
  select rp.id, rp.target_seat_count, rc.case_type
    into v_panel_id, v_target, v_case_type
    from public.review_panels rp
    join public.review_cases rc on rc.id = rp.case_id
    where rp.case_id = p_case_id and rp.closed_at is null
    for update of rp;

  if not found then
    return;
  end if;

  v_majority := v_target / 2 + 1;
  select
    count(*) filter (where d.decision = 'approved'),
    count(*) filter (where d.decision = 'rejected')
    into v_approve, v_reject
    from public.panel_members pm
    join public.review_decisions d on d.panel_member_id = pm.id
    where pm.panel_id = v_panel_id;

  if v_approve >= v_majority then
    v_outcome := 'approved';
  elsif v_reject >= v_majority then
    v_outcome := 'rejected';
  else
    return;
  end if;

  update public.review_panels
    set outcome = v_outcome, closed_at = now()
    where id = v_panel_id;

  update public.review_cases
    set status = v_outcome::text::public.case_status
    where id = p_case_id;

  if v_outcome <> 'approved' then
    return;
  end if;

  select grc.guide_revision_id, gr.guide_id, g.guide_base_id, gr.title
    into v_revision_id, v_guide_id, v_base_id, v_title
    from public.guide_review_cases grc
    join public.guide_revisions gr on gr.id = grc.guide_revision_id
    join public.guides g on g.id = gr.guide_id
    where grc.case_id = p_case_id;

  update public.guide_revisions
    set approved_at = now()
    where id = v_revision_id;

  if v_case_type = 'guide_publish' then
    v_slug_base := lower(
      trim(both '-' from regexp_replace(coalesce(v_title, ''), '[^a-zA-Z0-9]+', '-', 'g'))
    );
    if v_slug_base = '' then
      v_slug_base := 'guide';
    end if;
    v_slug := v_slug_base;
    v_suffix := 1;
    while exists (
      select 1 from public.guides
      where guide_base_id = v_base_id and slug = v_slug and id <> v_guide_id
    ) loop
      v_suffix := v_suffix + 1;
      v_slug := v_slug_base || '-' || v_suffix;
    end loop;

    update public.guides
      set current_revision_id = v_revision_id,
          status = 'published',
          slug = coalesce(slug, v_slug)
      where id = v_guide_id;

    update public.guide_bases
      set status = 'published',
          canonical_guide_id = coalesce(canonical_guide_id, v_guide_id)
      where id = v_base_id;
  else
    update public.guides
      set current_revision_id = v_revision_id
      where id = v_guide_id;
  end if;

  update public.subjects s
    set status = 'published'
    from public.guide_revision_subjects grs
    where grs.guide_revision_id = v_revision_id
      and grs.subject_id = s.id
      and s.status <> 'published';
end;
$$;

grant execute on function public.close_review_panel(uuid) to authenticated, service_role;
