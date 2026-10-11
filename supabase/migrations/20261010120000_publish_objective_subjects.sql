-- Same as the previous publish_objective_revision except subjects proposed
-- inline on the objective are approved with it: they get their slug, suffixed
-- if the handle is taken, and go published, as close_review_panel does for a
-- guide. A curator's publish is the objective's only approval.
create or replace function public.publish_objective_revision(p_revision_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_objective_id uuid;
  v_status public.objective_revision_status;
  v_author_id uuid;
  v_title text;
  v_slug text;
  v_based_on_revision_id uuid;
  v_current_revision_id uuid;
  v_node record;
  v_request_id uuid;
  v_subject record;
  v_subject_slug_base text;
  v_subject_slug text;
  v_subject_suffix integer;
begin
  if not public.has_role('curator') then
    raise exception 'Only curators can publish objectives'
      using errcode = 'insufficient_privilege';
  end if;

  select objective_id, status, author_id, title, based_on_revision_id
    into v_objective_id, v_status, v_author_id, v_title, v_based_on_revision_id
    from public.objective_revisions
    where id = p_revision_id
    for update;

  if not found then
    raise exception 'Revision not found' using errcode = 'no_data_found';
  end if;

  if v_author_id is distinct from (select auth.uid()) then
    raise exception 'You can only publish a revision you authored'
      using errcode = 'insufficient_privilege';
  end if;

  if v_status <> 'draft' then
    raise exception 'Revision is not an editable draft'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Drafts from before this column carry null and publish unchecked, with
  -- nothing to compare against.
  if v_based_on_revision_id is not null then
    select current_revision_id into v_current_revision_id
      from public.objectives
      where id = v_objective_id;

    if v_based_on_revision_id is distinct from v_current_revision_id then
      raise exception 'A newer revision was published; review it before publishing'
        using errcode = 'serialization_failure';
    end if;
  end if;

  -- The slug is frozen from the title on first publish, so the title must exist
  -- by then.
  select slug into v_slug from public.objectives where id = v_objective_id;
  if v_slug is null and coalesce(trim(v_title), '') = '' then
    raise exception 'A title is required to publish an objective'
      using errcode = 'invalid_parameter_value';
  end if;

  if not exists (
    select 1 from public.objective_revision_nodes
      where revision_id = p_revision_id and is_target
  ) then
    raise exception 'At least one target guide is required to publish an objective'
      using errcode = 'invalid_parameter_value';
  end if;

  update public.objective_revisions
    set status = 'published',
        published_at = now()
    where id = p_revision_id;

  for v_node in
    select id, title, summary
      from public.objective_revision_nodes
      where revision_id = p_revision_id
        and guide_base_id is null
        and request_id is null
  loop
    insert into public.requests (objective_id, title, summary, status)
      values (v_objective_id, v_node.title, v_node.summary, 'open')
      returning id into v_request_id;

    update public.objective_revision_nodes
      set request_id = v_request_id
      where id = v_node.id;
  end loop;

  -- drawn edges only; the projection bridges gaps
  insert into public.guide_edges (from_guide_base_id, to_guide_base_id, edge_type)
  select f.guide_base_id, t.guide_base_id, 'prerequisite'
    from public.objective_revision_edges e
    join public.objective_revision_nodes f on f.id = e.from_node_id
    join public.objective_revision_nodes t on t.id = e.to_node_id
    where e.revision_id = p_revision_id
      and f.guide_base_id is not null
      and t.guide_base_id is not null
    on conflict do nothing;

  -- The projection still names guide bases, so each endpoint lands through the
  -- node that holds it in this revision.
  insert into public.objective_revision_edges
    (revision_id, from_node_id, to_node_id)
  select p_revision_id, f.id, t.id
    from public.project_objective_edges(p_revision_id) e
    join public.objective_revision_nodes f
      on f.revision_id = p_revision_id
     and f.guide_base_id = e.from_guide_base_id
    join public.objective_revision_nodes t
      on t.revision_id = p_revision_id
     and t.guide_base_id = e.to_guide_base_id
    on conflict (revision_id, from_node_id, to_node_id) do nothing;

  for v_subject in
    select s.id, s.name
      from public.subjects s
      join public.objective_revision_subjects ors on ors.subject_id = s.id
      where ors.objective_revision_id = p_revision_id
        and s.slug is null
      for update of s
  loop
    v_subject_slug_base := lower(
      trim(both '-' from regexp_replace(coalesce(v_subject.name, ''), '[^a-zA-Z0-9]+', '-', 'g'))
    );
    if v_subject_slug_base = '' then
      v_subject_slug_base := 'subject';
    end if;

    v_subject_slug := v_subject_slug_base;
    v_subject_suffix := 1;
    while exists (
      select 1 from public.subjects where slug = v_subject_slug
    ) loop
      v_subject_suffix := v_subject_suffix + 1;
      v_subject_slug := v_subject_slug_base || '-' || v_subject_suffix;
    end loop;

    update public.subjects set slug = v_subject_slug where id = v_subject.id;
  end loop;

  update public.subjects s
    set status = 'published'
    from public.objective_revision_subjects ors
    where ors.objective_revision_id = p_revision_id
      and ors.subject_id = s.id
      and s.status <> 'published';

  update public.objectives
    set current_revision_id = p_revision_id,
        status = 'published',
        slug = coalesce(
          slug,
          lower(trim(both '-' from
            regexp_replace(v_title, '[^a-zA-Z0-9]+', '-', 'g')))
        )
    where id = v_objective_id
    returning slug into v_slug;

  -- Return the live slug so the client can route to /objectives/{slug}.
  return v_slug;
end;
$$;
