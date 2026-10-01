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
  insert into public.guide_edges (from_guide_base_id, to_guide_base_id, edge_type)
    values (new.resolved_guide_base_id, new.dependent_guide_base_id, 'prerequisite')
    on conflict do nothing;
  return null;
exception when raise_exception or check_violation then
  -- guide_edges_prevent_cycle: the requester already depends on this guide.
  return null;
end;
$$;

create trigger todo_prerequisites_link_on_resolve
  after update of status on public.todo_prerequisites
  for each row
  when (old.status = 'open' and new.status = 'resolved')
  execute function public.link_resolved_todo();
