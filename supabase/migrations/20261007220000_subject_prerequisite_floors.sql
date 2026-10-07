-- A subject's prerequisite floor: the guide bases a walkthrough scoped to that
-- subject treats as assumed knowledge. The floor guide itself still appears
-- (it is where the climb starts) but nothing below it is expanded, so a
-- physics walkthrough stops at arithmetic and algebra instead of chasing every
-- primitive. See docs/overall-system.md ("prerequisite floor") and
-- docs/database-schema.md ("subject_prerequisite_floors").

create table public.subject_prerequisite_floors (
  subject_id uuid not null references public.subjects (id) on delete cascade,
  guide_base_id uuid not null references public.guide_bases (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (subject_id, guide_base_id)
);

create index subject_prerequisite_floors_guide_base_id_idx
  on public.subject_prerequisite_floors (guide_base_id);

alter table public.subject_prerequisite_floors enable row level security;

-- Floors shape public walkthroughs, so anyone may read them.
create policy "Anyone can view subject floors"
  on public.subject_prerequisite_floors for select
  using (true);

-- Writes are governance-only.
create policy "Admins can add floor guides"
  on public.subject_prerequisite_floors for insert to authenticated
  with check (public.has_role('admin'::public.app_role));

create policy "Admins can remove floor guides"
  on public.subject_prerequisite_floors for delete to authenticated
  using (public.has_role('admin'::public.app_role));

-- Replace a subject's floor in one transaction, so a save never leaves a
-- half-applied set behind. An empty list clears the floor.
create or replace function public.set_subject_floor(
  p_subject_id uuid,
  p_guide_base_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('admin'::public.app_role) then
    raise exception 'Only admins can change a subject floor'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.subjects where id = p_subject_id) then
    raise exception 'Subject not found' using errcode = 'P0002';
  end if;

  delete from public.subject_prerequisite_floors
    where subject_id = p_subject_id
      and not (guide_base_id = any(p_guide_base_ids));

  insert into public.subject_prerequisite_floors (subject_id, guide_base_id)
    select p_subject_id, unnest(p_guide_base_ids)
    on conflict do nothing;
end;
$$;

revoke execute on function public.set_subject_floor(uuid, uuid[])
  from public, anon;
grant execute on function public.set_subject_floor(uuid, uuid[])
  to authenticated, service_role;

-- compute_walkthrough gains an optional subject scope. Within that scope the
-- prerequisite climb does not expand below a floor guide of the subject, and
-- every node reports whether it is one. The old two-argument signature goes,
-- so callers that omit the scope resolve to this function.
drop function public.compute_walkthrough(uuid, integer);

create or replace function public.compute_walkthrough(
  p_guide_base_id uuid,
  p_follow_up_depth integer default null,
  p_subject_id uuid default null
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

  with recursive floor as (
    select f.guide_base_id
    from public.subject_prerequisite_floors f
    where p_subject_id is not null and f.subject_id = p_subject_id
  ),
  prerequisite_closure as (
    select p_guide_base_id as node_id
    union
    select e.from_guide_base_id
    from prerequisite_closure c
    join public.guide_edges e
      on e.to_guide_base_id = c.node_id
     and e.edge_type = 'prerequisite'
     and not e.is_suspended
    -- A floor guide is the bottom of a scoped climb: shown, not expanded.
    where c.node_id not in (select guide_base_id from floor)
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
    select nl.node_id, nl.level, gb.slug, cr.title, cr.summary, cr.word_count,
           cr.id as revision_id,
           exists (
             select 1 from floor f where f.guide_base_id = nl.node_id
           ) as is_floor
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
          'is_floor', vn.is_floor,
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

grant execute on function public.compute_walkthrough(uuid, integer, uuid)
  to anon, authenticated;
