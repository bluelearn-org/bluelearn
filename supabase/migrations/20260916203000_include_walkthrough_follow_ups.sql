drop function public.compute_walkthrough(uuid);

create or replace function public.compute_walkthrough(
  p_guide_base_id uuid,
  p_follow_up_depth integer default 1
)
returns jsonb
language sql
security invoker
set search_path = ''
stable
as $$
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
  follow_up_closure as (
    select p_guide_base_id as node_id, 0 as depth
    union
    select e.to_guide_base_id, c.depth + 1
    from follow_up_closure c
    join public.guide_edges e
      on e.from_guide_base_id = c.node_id
     and e.edge_type = 'prerequisite'
     and not e.is_suspended
    where c.depth < least(greatest(coalesce(p_follow_up_depth, 1), 0), 100)
  ),
  closure as (
    select node_id from prerequisite_closure
    union
    select node_id from follow_up_closure
  ),
  -- keep one level scale through the target
  -- so the graph can place prerequisites
  -- below it and follow-ups above it!
  forward_paths as (
    select c.node_id, 1 as level
    from closure c
    where not exists (
      select 1 from public.guide_edges e
      where e.to_guide_base_id = c.node_id
        and e.edge_type = 'prerequisite'
        and not e.is_suspended
    )
    union
    select e.to_guide_base_id, fp.level + 1
    from forward_paths fp
    join public.guide_edges e
      on e.from_guide_base_id = fp.node_id
     and e.edge_type = 'prerequisite'
     and not e.is_suspended
    join closure c on c.node_id = e.to_guide_base_id
    -- enough: Walkthroughs stop at 100 levels. Raise this limit when valid paths exceed it.
    where fp.level < 100
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
    select e.from_guide_base_id as from_id, e.to_guide_base_id as to_id
    from public.guide_edges e
    where e.edge_type = 'prerequisite'
      and not e.is_suspended
      and e.from_guide_base_id in (select node_id from visible_nodes)
      and e.to_guide_base_id in (select node_id from visible_nodes)
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
  );
$$;

grant execute on function public.compute_walkthrough(uuid, integer) to anon, authenticated;
