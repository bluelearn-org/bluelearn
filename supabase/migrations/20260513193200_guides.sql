-- Core content graph: guide_bases (graph nodes) → guides (methods/alternatives/
-- the original write-up) → guide_revisions (immutable, append-only snapshots)

-- Theory → variants display as "alternatives"; practice → "methods".
create type public.knowledge_type as enum ('theory', 'practice');

-- Lasting disposition of a graph node
create type public.node_status as enum ('draft', 'published', 'archived');

-- A revision only owns the part of its lifecycle it controls. Everything past
-- handoff (in review / accepted / rejected) is derived from its review case.
create type public.revision_status as enum ('draft', 'submitted');

create table public.guide_bases (
  id uuid primary key default gen_random_uuid(),
  -- FK added below (deferrable) once guides exists. Null before first publish.
  canonical_guide_id uuid,
  slug text not null unique,
  title text not null,
  knowledge_type public.knowledge_type not null,
  status public.node_status not null default 'draft',
  -- Self-reference: set when a cross-subject conflict spins this base off a
  -- parent. Makes the spin-off an explicit, governed exception.
  forked_from_guide_base_id uuid references public.guide_bases (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Slugs are URL handles: stored lowercase so uniqueness is case-insensitive.
  constraint guide_bases_slug_lowercase check (slug = lower(slug))
);

create table public.guides (
  id uuid primary key default gen_random_uuid(),
  guide_base_id uuid not null references public.guide_bases (id) on delete cascade,
  slug text,
  -- FK added below (deferrable). Null before first publish.
  current_revision_id uuid,
  status public.node_status not null default 'draft',
  author_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Per-base slug uniqueness (the /{base}/{guide} permalink); null slugs (drafts)
  -- are exempt because NULLs are distinct in a unique index.
  constraint guides_slug_unique_per_base unique (guide_base_id, slug),
  -- Composite FK target for guide_bases.canonical_guide_id: lets the canonical
  -- pointer be constrained to a guide of the same base (not any guide in general).
  constraint guides_id_base_unique unique (id, guide_base_id),
  constraint guides_slug_lowercase check (slug = lower(slug))
);

create index guides_author_id_idx on public.guides (author_id);

create table public.guide_revisions (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references public.guides (id) on delete cascade,
  revision_number integer not null,
  title text,
  summary text,
  body text,
  change_summary text,
  author_id uuid references public.profiles (id) on delete set null,
  status public.revision_status not null default 'draft',
  is_purged boolean not null default false,
  created_at timestamptz not null default now(),
  constraint guide_revisions_number_unique unique (guide_id, revision_number),
  -- Composite FK target for guides.current_revision_id: constrains the live
  -- pointer to one of this guide's own revisions.
  constraint guide_revisions_id_guide_unique unique (id, guide_id)
);

-- Uses a composite FK (canonical_guide_id, id) to guarantee 
-- that the chosen canonical guide actually belongs to this specific topic.
-- If the canonical guide is destroyed, it only clears the pointer
-- column, preventing a dangling ID without affecting the topic's primary key.
alter table public.guide_bases
  add constraint guide_bases_canonical_guide_id_fkey
  foreign key (canonical_guide_id, id) references public.guides (id, guide_base_id)
  on delete set null (canonical_guide_id)
  deferrable initially deferred;

alter table public.guides
  add constraint guides_current_revision_id_fkey
  foreign key (current_revision_id, id) references public.guide_revisions (id, guide_id)
  on delete set null (current_revision_id)
  deferrable initially deferred;

create trigger guide_bases_touch_updated_at
  before update on public.guide_bases
  for each row execute function public.touch_updated_at();

create trigger guides_touch_updated_at
  before update on public.guides
  for each row execute function public.touch_updated_at();

-- Row-level security policies
alter table public.guide_bases enable row level security;
alter table public.guides enable row level security;
alter table public.guide_revisions enable row level security;

create policy "Published topics are viewable by everyone"
  on public.guide_bases for select
  using (
    status <> 'draft'
    or exists (
      select 1 from public.guides g
      where g.guide_base_id = id and g.author_id = (select auth.uid())
    )
  );

create policy "Authenticated users can create draft topics"
  on public.guide_bases for insert
  to authenticated
  with check (status = 'draft');

create policy "Guide authors can update their draft topics"
  on public.guide_bases for update
  to authenticated
  using (
    status = 'draft'
    and exists (
      select 1 from public.guides g
      where g.guide_base_id = id and g.author_id = (select auth.uid())
    )
  )
  with check (status = 'draft');

create policy "Moderators can update topics except publishing"
  on public.guide_bases for update
  to authenticated
  using (public.has_role('moderator') or public.has_role('admin'))
  with check (
    (public.has_role('moderator') or public.has_role('admin'))
    and status in ('draft', 'archived')
  );

create policy "Published guides are viewable by everyone"
  on public.guides for select
  using (status <> 'draft' or author_id = (select auth.uid()));

create policy "Authors can create their own draft guides"
  on public.guides for insert
  to authenticated
  with check (author_id = (select auth.uid()) and status = 'draft');

create policy "Authors can update their own guides except publishing"
  on public.guides for update
  to authenticated
  using (author_id = (select auth.uid()))
  with check (
    author_id = (select auth.uid())
    and status in ('draft', 'archived')
  );

create policy "Moderators can update guides except publishing"
  on public.guides for update
  to authenticated
  using (public.has_role('moderator') or public.has_role('admin'))
  with check (
    (public.has_role('moderator') or public.has_role('admin'))
    and status in ('draft', 'archived')
  );

create policy "Submitted revisions are viewable by everyone"
  on public.guide_revisions for select
  using (status = 'submitted' or author_id = (select auth.uid()));

create policy "Authors can create their own draft revisions"
  on public.guide_revisions for insert
  to authenticated
  with check (author_id = (select auth.uid()) and status = 'draft');

create policy "Authors can edit and submit their own draft revisions"
  on public.guide_revisions for update
  to authenticated
  using (author_id = (select auth.uid()) and status = 'draft')
  with check (author_id = (select auth.uid()));
