create or replace function public.create_objective(
  p_targets uuid[],
  p_title text default null,
  p_summary text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_objective_id uuid := gen_random_uuid();
  v_revision_id uuid := gen_random_uuid();
begin
  insert into public.objectives (id, created_by, status)
    values (v_objective_id, auth.uid(), 'draft');

  insert into public.objective_revisions
    (id, objective_id, title, summary, author_id, status)
    values (v_revision_id, v_objective_id, p_title, p_summary, auth.uid(), 'draft');

  insert into public.objective_revision_nodes
    (revision_id, guide_base_id, guide_id, is_target)
  with recursive closure as (
    select unnest(p_targets) as node_id
    union
    select e.from_guide_base_id
    from closure c
    join public.guide_edges e
      on e.to_guide_base_id = c.node_id
     and e.edge_type = 'prerequisite'
     and not e.is_suspended
  )
  select
    v_revision_id,
    gb.id,
    gb.canonical_guide_id,
    gb.id = any (p_targets)
  from closure c
  join public.guide_bases gb on gb.id = c.node_id;

  -- Return the draft revision id so the client routes straight to its editor.
  return v_revision_id;
end;
$$;
