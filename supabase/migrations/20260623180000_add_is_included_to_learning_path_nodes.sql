-- Skipping a topic in the editor hides it (is_included = false) instead of
-- deleting its row: the row stays so the editor can list it as a re-includable
-- candidate and so edge projection can bridge across it. Only included rows
-- reach the published curriculum. project_path_edges is redefined to project
-- over included nodes only, so a skipped prereq bridges.

alter table public.learning_path_revision_nodes
  add column is_included boolean not null default true;

-- Project guide_edges onto a revision's included nodes. The walk starts at each
-- included node and recurses backward through excluded intermediates (skipped
-- nodes or guides absent from the revision), so a skipped prereq (A -> Trig -> B
-- with Trig excluded) bridges to A -> B.
create or replace function public.project_path_edges(p_revision_id uuid)
returns table (from_guide_base_id uuid, to_guide_base_id uuid)
language sql
security invoker
set search_path = ''
stable
as $$
  with recursive
  included as (
    select guide_base_id
    from public.learning_path_revision_nodes
    where revision_id = p_revision_id
      and is_included
  ),
  -- anchor = the included node we are finding prerequisites for; cur = the node
  -- reached walking backward from it.
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
