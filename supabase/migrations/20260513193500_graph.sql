-- The global learning graph: edges between guide bases, subject tags over the
-- graph, and author-declared missing prerequisites

create type public.edge_type as enum ('prerequisite', 'related');

create table public.guide_edges (
  id uuid primary key default gen_random_uuid(),
  from_guide_base_id uuid not null references public.guide_bases (id) on delete cascade,
  to_guide_base_id uuid not null references public.guide_bases (id) on delete cascade,
  edge_type public.edge_type not null,
  constraint guide_edges_no_self_loop
    check (from_guide_base_id <> to_guide_base_id)
);

-- One prerequisite edge per ordered pair
create unique index guide_edges_prerequisite_unique
  on public.guide_edges (from_guide_base_id, to_guide_base_id)
  where edge_type = 'prerequisite';

create index guide_edges_from_guide_base_id_idx on public.guide_edges (from_guide_base_id);
create index guide_edges_to_guide_base_id_idx on public.guide_edges (to_guide_base_id);

-- Prevents prerequisite edges from creating cycles.
-- Before inserting A → B, verify that B cannot already reach A
-- through existing prerequisite edges.
create or replace function public.prevent_prerequisite_cycle()
returns trigger
language plpgsql
as $$
begin
  if new.edge_type <> 'prerequisite' then
    return new;
  end if;

  if exists (
    with recursive reachable as (
      select e.to_guide_base_id as node
      from public.guide_edges e
      where e.edge_type = 'prerequisite'
        and e.from_guide_base_id = new.to_guide_base_id
      union
      select e.to_guide_base_id
      from public.guide_edges e
      join reachable r on e.from_guide_base_id = r.node
      where e.edge_type = 'prerequisite'
    )
    select 1 from reachable where node = new.from_guide_base_id
  ) then
    raise exception
      'prerequisite edge % -> % would create a cycle',
      new.from_guide_base_id, new.to_guide_base_id;
  end if;

  return new;
end;
$$;

create trigger guide_edges_prevent_cycle
  before insert or update on public.guide_edges
  for each row execute function public.prevent_prerequisite_cycle();

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  creator_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Slugs are URL handles: stored lowercase so uniqueness is case-insensitive.
  constraint subjects_slug_lowercase check (slug = lower(slug))
);

create table public.guide_subjects (
  guide_base_id uuid not null references public.guide_bases (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  primary key (guide_base_id, subject_id)
);

create index guide_subjects_subject_id_idx on public.guide_subjects (subject_id);

-- Missing prerequisite topics declared before a real base exists
create type public.todo_status as enum ('open', 'resolved');

create table public.todo_prerequisites (
  id uuid primary key default gen_random_uuid(),
  dependent_guide_base_id uuid not null references public.guide_bases (id) on delete cascade,
  title text not null,
  status public.todo_status not null default 'open',
  resolved_guide_base_id uuid references public.guide_bases (id) on delete set null,
  created_at timestamptz not null default now(),
  -- A todo is resolved iff it points at the base that resolved it.
  constraint todo_prerequisites_resolved_has_base
    check ((status = 'resolved') = (resolved_guide_base_id is not null))
);

create index todo_prerequisites_dependent_idx
  on public.todo_prerequisites (dependent_guide_base_id);

-- When the resolving base is deleted, its FK set-null fires this update: flip
-- the todo back to open so the set-null doesn't trip the check above.
create or replace function public.reopen_unresolved_todo()
returns trigger
language plpgsql
as $$
begin
  if new.resolved_guide_base_id is null and new.status = 'resolved' then
    new.status := 'open';
  end if;
  return new;
end;
$$;

create trigger todo_prerequisites_reopen_on_unresolve
  before update on public.todo_prerequisites
  for each row execute function public.reopen_unresolved_todo();

-- Row-level security policies
alter table public.guide_edges enable row level security;
alter table public.subjects enable row level security;
alter table public.guide_subjects enable row level security;
alter table public.todo_prerequisites enable row level security;

create policy "Guide edges are viewable by everyone"
  on public.guide_edges for select
  using (true);

create policy "Guide authors can add edges touching their topics"
  on public.guide_edges for insert
  to authenticated
  with check (
    exists (
      select 1 from public.guides g
      where g.guide_base_id in (from_guide_base_id, to_guide_base_id)
        and g.author_id = (select auth.uid())
    )
  );

create policy "Moderators can delete edges"
  on public.guide_edges for delete
  to authenticated
  using (public.has_role('moderator') or public.has_role('admin'));

create policy "Subjects are viewable by everyone"
  on public.subjects for select
  using (true);

create policy "Authenticated users can create subjects"
  on public.subjects for insert
  to authenticated
  with check (creator_id = (select auth.uid()));

create policy "Subject tags are viewable by everyone"
  on public.guide_subjects for select
  using (true);

create policy "Guide authors can tag their topics"
  on public.guide_subjects for insert
  to authenticated
  with check (
    exists (
      select 1 from public.guides g
      where g.guide_base_id = guide_subjects.guide_base_id
        and g.author_id = (select auth.uid())
    )
  );

create policy "Moderators can untag topics"
  on public.guide_subjects for delete
  to authenticated
  using (public.has_role('moderator') or public.has_role('admin'));

create policy "Todo prerequisites are viewable by everyone"
  on public.todo_prerequisites for select
  using (true);

create policy "Guide authors can declare todos on their topics"
  on public.todo_prerequisites for insert
  to authenticated
  with check (
    exists (
      select 1 from public.guides g
      where g.guide_base_id = dependent_guide_base_id
        and g.author_id = (select auth.uid())
    )
  );
