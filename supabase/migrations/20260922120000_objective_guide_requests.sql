-- requests --------------------------------------------------------------------

alter table public.requests
  alter column dependent_guide_base_id drop not null;

alter table public.requests
  add column objective_id uuid references public.objectives (id) on delete restrict;

create index requests_objective_idx on public.requests (objective_id);

-- A todo resolved by a published guide becomes a prerequisite edge from that
-- guide to the one that requested it. Without the edge the requester's page
-- dropped the entry entirely: the API lists open todos and guide_edges, nothing else.
create or replace function public.link_resolved_todo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- enough: an objective-raised request has no dependent guide, so there is no
  -- guide_edges row to write and this trigger has nothing to say about it. Such
  -- a request keeps its arrows on the frozen canvas (objective_revision_edges),
  -- which this function does not read. The way up: walk the edges of the nodes
  -- whose request_id = new.id and insert one guide_edges row per guide endpoint.
  if new.dependent_guide_base_id is null then
    return null;
  end if;

  insert into public.guide_edges (from_guide_base_id, to_guide_base_id, edge_type)
    values (new.resolved_guide_base_id, new.dependent_guide_base_id, 'prerequisite')
    on conflict do nothing;
  return null;
exception when raise_exception or check_violation then
  -- guide_edges_prevent_cycle: the requester already depends on this guide.
  return null;
end;
$$;

-- objective_revision_nodes ----------------------------------------------------

alter table public.objective_revision_nodes
  alter column guide_base_id drop not null,
  alter column guide_id drop not null;

alter table public.objective_revision_nodes
  add column request_id uuid references public.requests (id) on delete set null,
  add column title text,
  add column summary text;

-- A node is a guide or a request, never both and never neither.
-- A request node carries its own text because there is no guide revision
-- to read it from.
alter table public.objective_revision_nodes
  add constraint objective_revision_nodes_guide_or_request
  check (
    (
      guide_base_id is not null
      and guide_id is not null
      and request_id is null
      and title is null
      and summary is null
    )
    or (
      guide_base_id is null
      and guide_id is null
      and title is not null
      and summary is not null
    )
  );

-- A target is what the objective aims the learner at, and the closure is walked
-- from its guide base. A request has none.
alter table public.objective_revision_nodes
  add constraint objective_revision_nodes_target_is_guide
  check (not is_target or guide_base_id is not null);

alter table public.objective_revision_nodes
  add constraint objective_revision_nodes_revision_request_key
  unique (revision_id, request_id);

-- objective_revision_edges ----------------------------------------------------

-- Re-keyed from guide base ids to node ids: an endpoint may now be a request
-- node, which has no guide base to name it by.
alter table public.objective_revision_edges
  add column from_node_id uuid,
  add column to_node_id uuid;

update public.objective_revision_edges e
  set from_node_id = f.id,
      to_node_id = t.id
  from public.objective_revision_nodes f,
       public.objective_revision_nodes t
  where f.revision_id = e.revision_id
    and f.guide_base_id = e.from_guide_base_id
    and t.revision_id = e.revision_id
    and t.guide_base_id = e.to_guide_base_id;

alter table public.objective_revision_edges
  alter column from_node_id set not null,
  alter column to_node_id set not null;

alter table public.objective_revision_edges
  drop constraint objective_revision_edges_from_is_node,
  drop constraint objective_revision_edges_to_is_node,
  drop constraint learning_path_revision_edges_pkey,
  drop constraint learning_path_revision_edges_no_self_loop;

alter table public.objective_revision_edges
  drop column from_guide_base_id,
  drop column to_guide_base_id;

alter table public.objective_revision_edges
  add constraint objective_revision_edges_pkey
    primary key (revision_id, from_node_id, to_node_id),
  add constraint objective_revision_edges_from_is_node
    foreign key (from_node_id, revision_id)
    references public.objective_revision_nodes (id, revision_id)
    on delete cascade,
  add constraint objective_revision_edges_to_is_node
    foreign key (to_node_id, revision_id)
    references public.objective_revision_nodes (id, revision_id)
    on delete cascade,
  add constraint objective_revision_edges_no_self_loop
    check (from_node_id <> to_node_id);

-- objective_revisions ---------------------------------------------------------

alter table public.objective_revisions
  add column based_on_revision_id uuid
    references public.objective_revisions (id) on delete set null;

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
      raise exception 'A newer revision was published; review it before publishing';
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
     and t.guide_base_id = e.to_guide_base_id;

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

grant execute on function public.publish_objective_revision(uuid) to authenticated;

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

  insert into public.objective_revision_nodes
    (revision_id, guide_base_id, guide_id, is_target, is_included, note,
     target_position, is_featured)
  select v_new_revision_id, guide_base_id, guide_id, is_target, is_included, note,
     target_position, is_featured
    from public.objective_revision_nodes
    where revision_id = p_source_revision_id;

  insert into public.objective_revision_node_orders
    (revision_id, target_node_id, node_id, position)
  select v_new_revision_id, tn.id, sn.id, o.position
    from public.objective_revision_node_orders o
    join public.objective_revision_nodes src_t on src_t.id = o.target_node_id
    join public.objective_revision_nodes src_n on src_n.id = o.node_id
    join public.objective_revision_nodes tn
      on tn.revision_id = v_new_revision_id
     and tn.guide_base_id = src_t.guide_base_id
    join public.objective_revision_nodes sn
      on sn.revision_id = v_new_revision_id
     and sn.guide_base_id = src_n.guide_base_id
    where o.revision_id = p_source_revision_id;

  -- Return the draft revision id so the client routes straight to its editor.
  return v_new_revision_id;
end;
$$;

grant execute on function public.rollback_objective_revision(uuid, uuid)
  to authenticated;
