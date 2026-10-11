-- Request nodes have no guide base. A NULL in this set stops NOT IN recursion.
create or replace function public.project_objective_edges(p_revision_id uuid)
returns table (from_guide_base_id uuid, to_guide_base_id uuid)
language sql
security invoker
set search_path = ''
stable
as $$
  with recursive
  included as (
    select guide_base_id
    from public.objective_revision_nodes
    where revision_id = p_revision_id
      and guide_base_id is not null
  ),
  walk as (
    select n.guide_base_id as anchor, e.from_guide_base_id as cur
    from included n
    join public.guide_edges e
      on e.to_guide_base_id = n.guide_base_id
     and e.edge_type = 'prerequisite'
     and not e.is_suspended
    union
    select w.anchor, e.from_guide_base_id
    from walk w
    join public.guide_edges e
      on e.to_guide_base_id = w.cur
     and e.edge_type = 'prerequisite'
     and not e.is_suspended
    where w.cur not in (select guide_base_id from included)
  )
  select distinct cur as from_guide_base_id, anchor as to_guide_base_id
  from walk
  where cur in (select guide_base_id from included);
$$;
