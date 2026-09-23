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

  -- A draft written before this column existed carries null and publishes
  -- unchecked; there is no recorded starting point to compare against.
  if v_based_on_revision_id is not null then
    select current_revision_id into v_current_revision_id
      from public.objectives
      where id = v_objective_id;

    if v_based_on_revision_id is distinct from v_current_revision_id then
      raise exception 'A newer revision was published; review it before publishing'
        using errcode = 'serialization_failure';
    end if;
  end if;

  -- On first publish the objective has no slug yet; derive and freeze it from
  -- the title, which must be present by then.
  select slug into v_slug from public.objectives where id = v_objective_id;
  if v_slug is null and coalesce(trim(v_title), '') = '' then
    raise exception 'A title is required to publish an objective'
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

create or replace function public.rollback_objective_revision(
  p_revision_id uuid,
  p_source_revision_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_objective_id uuid;
  v_title text;
  v_summary text;
  v_created_at timestamptz;
  v_current_revision_id uuid;
  v_new_revision_id uuid := gen_random_uuid();
  v_old_node_ids uuid[];
  v_new_node_ids uuid[];
begin
  -- The anchor revision names the objective being rolled back. RLS hides
  -- revisions the caller may not read, so an unseen one reads as missing.
  select objective_id into v_objective_id
    from public.objective_revisions
    where id = p_revision_id;

  if not found then
    raise exception 'Revision not found' using errcode = 'no_data_found';
  end if;

  -- The source must belong to that same objective or there is nothing to
  -- restore here.
  select title, summary, created_at
    into v_title, v_summary, v_created_at
    from public.objective_revisions
    where id = p_source_revision_id
      and objective_id = v_objective_id;

  if not found then
    raise exception 'Revision not found for this objective'
      using errcode = 'no_data_found';
  end if;

  select current_revision_id into v_current_revision_id
    from public.objectives
    where id = v_objective_id;

  insert into public.objective_revisions
    (id, objective_id, title, summary, change_summary, author_id, status,
     based_on_revision_id)
    values (
      v_new_revision_id,
      v_objective_id,
      v_title,
      v_summary,
      'Rolled back to revision from ' || to_char(v_created_at, 'YYYY-MM-DD'),
      auth.uid(),
      'draft',
      v_current_revision_id
    );

  select array_agg(id), array_agg(gen_random_uuid())
    into v_old_node_ids, v_new_node_ids
    from public.objective_revision_nodes
    where revision_id = p_source_revision_id;

  insert into public.objective_revision_nodes
    (id, revision_id, guide_base_id, guide_id, request_id, title, summary,
     is_target, is_included, note, target_position, is_featured)
  select m.new_id, v_new_revision_id, n.guide_base_id, n.guide_id, n.request_id,
     n.title, n.summary, n.is_target, n.is_included, n.note, n.target_position,
     n.is_featured
    from unnest(v_old_node_ids, v_new_node_ids) as m (old_id, new_id)
    join public.objective_revision_nodes n on n.id = m.old_id;

  insert into public.objective_revision_node_orders
    (revision_id, target_node_id, node_id, position)
  select v_new_revision_id, t.new_id, n.new_id, o.position
    from public.objective_revision_node_orders o
    join unnest(v_old_node_ids, v_new_node_ids) as t (old_id, new_id)
      on t.old_id = o.target_node_id
    join unnest(v_old_node_ids, v_new_node_ids) as n (old_id, new_id)
      on n.old_id = o.node_id
    where o.revision_id = p_source_revision_id;

  insert into public.objective_revision_edges
    (revision_id, from_node_id, to_node_id)
  select v_new_revision_id, f.new_id, t.new_id
    from public.objective_revision_edges e
    join unnest(v_old_node_ids, v_new_node_ids) as f (old_id, new_id)
      on f.old_id = e.from_node_id
    join unnest(v_old_node_ids, v_new_node_ids) as t (old_id, new_id)
      on t.old_id = e.to_node_id
    where e.revision_id = p_source_revision_id;

  -- Return the draft revision id so the client routes straight to its editor.
  return v_new_revision_id;
end;
$$;
