alter table public.requests
  alter column dependent_guide_base_id drop not null;

alter table public.requests
  add constraint standalone_request_content_valid check (
    dependent_guide_base_id is not null
    or (
      title ~ '[^[:space:]]'
      and char_length(title) between 1 and 50
      and char_length(summary) <= 500
    )
  );

drop policy if exists "Guide authors can declare todos on their topics"
  on public.requests;

create policy "Authenticated users can create guide requests"
  on public.requests for insert
  to authenticated
  with check (
    dependent_guide_base_id is null
    or exists (
      select 1
      from public.guides g
      where g.guide_base_id = dependent_guide_base_id
        and g.author_id = (select auth.uid())
    )
  );

-- Standalone requests resolve without creating a prerequisite edge.
create or replace function public.link_resolved_todo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.resolved_guide_base_id is null
     or new.dependent_guide_base_id is null then
    return null;
  end if;

  insert into public.guide_edges (from_guide_base_id, to_guide_base_id, edge_type)
    values (new.resolved_guide_base_id, new.dependent_guide_base_id, 'prerequisite')
    on conflict do nothing;
  return null;
exception when raise_exception or check_violation then
  -- The requester already depends on this guide, so no new edge is needed.
  return null;
end;
$$;
