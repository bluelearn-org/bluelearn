create or replace function public.compute_walkthrough(
  p_guide_base_id uuid,
  p_follow_up_depth integer default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
  follow_up_ids uuid[] := array[p_guide_base_id];
  frontier uuid[] := follow_up_ids;
  depth integer := 0;
  walkthrough jsonb;
  invalid_topology boolean;
begin
  while cardinality(frontier) > 0
    and (p_follow_up_depth is null or depth < greatest(p_follow_up_depth, 0))
  loop
    select coalesce(array_agg(distinct e.to_guide_base_id), array[]::uuid[])
      into frontier
    from public.guide_edges e
    where e.from_guide_base_id = any(frontier)
      and e.edge_type = 'prerequisite'
      and not e.is_suspended
      and not (e.to_guide_base_id = any(follow_up_ids));

    follow_up_ids := follow_up_ids || frontier;
    depth := depth + 1;
  end loop;

  with recursive prerequisite_closure as (
    select p_guide_base_id as node_id
    union
    select e.from_guide_base_id
    from prerequisite_closure c
    join public.guide_edges e
      on e.to_guide_base_id = c.node_id
     and e.edge_type = 'prerequisite'
     and not e.is_suspended
  ),
  closure as (
    select node_id from prerequisite_closure
    union
    select unnest(follow_up_ids)
  ),
  selected_edges as (
    select e.from_guide_base_id as from_id, e.to_guide_base_id as to_id
    from public.guide_edges e
    where e.edge_type = 'prerequisite'
      and not e.is_suspended
      and e.from_guide_base_id in (select node_id from closure)
      and e.to_guide_base_id in (select node_id from closure)
  ),
  forward_paths as (
    select c.node_id, 1 as level
    from closure c
    where not exists (
      select 1 from selected_edges e where e.to_id = c.node_id
    )
    union
    select e.to_id, fp.level + 1
    from forward_paths fp
    join selected_edges e on e.from_id = fp.node_id
    -- A DAG cannot exceed its node count; one extra level exposes a cycle.
    where fp.level <= (select count(*) from closure)
  ),
  node_levels as (
    select node_id, max(level) as level
    from forward_paths
    group by node_id
  ),
  visible_nodes as (
    select nl.node_id, nl.level, gb.slug, cr.title, cr.summary, cr.word_count, cr.id as revision_id
    from node_levels nl
    join public.guide_bases gb on gb.id = nl.node_id
    left join public.guides cg on cg.id = gb.canonical_guide_id
    left join public.guide_revisions cr on cr.id = cg.current_revision_id
  ),
  visible_edges as (
    select e.from_id, e.to_id
    from selected_edges e
    where e.from_id in (select node_id from visible_nodes)
      and e.to_id in (select node_id from visible_nodes)
  )
  select jsonb_build_object(
    'nodes', coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'id', vn.node_id,
          'slug', vn.slug,
          'title', vn.title,
          'summary', vn.summary,
          'level', vn.level,
          'word_count', coalesce(vn.word_count, 0),
          'tags', coalesce(
            (select jsonb_agg(jsonb_build_object('slug', s.slug, 'name', s.name))
             from public.guide_revision_subjects grs
             join public.subjects s on s.id = grs.subject_id
             where grs.guide_revision_id = vn.revision_id),
            '[]'::jsonb
          )
        )
        order by vn.level, vn.slug
      ) from visible_nodes vn),
      '[]'::jsonb
    ),
    'edges', coalesce(
      (select jsonb_agg(
        jsonb_build_object('from_id', from_id, 'to_id', to_id)
      ) from visible_edges),
      '[]'::jsonb
    )
  ),
  (select count(*) from node_levels) <> (select count(*) from closure)
    or exists (select 1 from node_levels where level > (select count(*) from closure))
  into walkthrough, invalid_topology;

  if invalid_topology then
    raise exception 'Walkthrough prerequisite graph contains a cycle'
      using errcode = '22023';
  end if;

  return walkthrough;
end;
$$;

grant execute on function public.compute_walkthrough(uuid, integer) to anon, authenticated;
