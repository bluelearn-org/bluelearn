-- Close a case's panel once majority agrees and publish on approval.
-- Called after every cast, but no-ops until a majority exists, so a
-- non-deciding vote leaves the panel open.
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

  -- Publish the reviewed revision.
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
    -- Slug from the title, made unique among siblings under the same base.
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

    -- The first published guide under a base makes the base live and canonical by
    -- default; a later sibling leaves the existing canonical untouched.
    update public.guide_bases
      set status = 'published',
          canonical_guide_id = coalesce(canonical_guide_id, v_guide_id)
      where id = v_base_id;
  else
    -- guide_edit: repoint the live revision only; slug and canonical are frozen.
    update public.guides
      set current_revision_id = v_revision_id
      where id = v_guide_id;
  end if;
end;
$$;

grant execute on function public.close_review_panel(uuid) to authenticated, service_role;
