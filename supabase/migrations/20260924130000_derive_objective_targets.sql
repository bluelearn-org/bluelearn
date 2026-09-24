-- A target is the endpoint of a sub-objective, derived by the API from the
-- revision's graph at save, and a request can be that endpoint. The flag's
-- position, featured, and unique-position checks still hold for a derived flag.
alter table public.objective_revision_nodes
  drop constraint objective_revision_nodes_target_is_guide;
