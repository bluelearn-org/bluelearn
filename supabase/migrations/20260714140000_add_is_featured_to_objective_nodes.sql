alter table public.objective_revision_nodes
  add column is_featured boolean not null default false;

-- A featured node is always a target.
alter table public.objective_revision_nodes
  add constraint objective_revision_nodes_featured_is_target_check
  check (not is_featured or is_target);

-- At most one featured node per revision.
create unique index objective_revision_nodes_one_featured_per_revision
  on public.objective_revision_nodes (revision_id)
  where is_featured;
