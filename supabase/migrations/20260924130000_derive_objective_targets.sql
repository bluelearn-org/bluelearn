-- The API now derives targets from the graph, and a request can be one.
-- The position, featured, and unique-position checks still apply.
alter table public.objective_revision_nodes
  drop constraint objective_revision_nodes_target_is_guide;
