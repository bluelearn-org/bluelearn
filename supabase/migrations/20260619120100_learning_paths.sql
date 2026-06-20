-- Learning paths: curator-authored curricula over the guide graph. Mirrors the
-- guide stack: learning_paths (stable node) → learning_path_revisions (append-
-- only snapshots) → revision_nodes (frozen membership) + revision_edges (frozen
-- projection of guide_edges onto the included nodes). Pre-publish review reuses
-- review_cases via a new satellite + two new case_type values.

-- New verifier-gated case types for path publish/edit
alter type public.case_type add value 'learning_path_publish';
alter type public.case_type add value 'learning_path_edit';

-- The stable identity of a path. Stores no curriculum or title/summary of its
-- own; those are versioned on revisions. Points at the live published revision.
create table public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  -- FK added below (deferrable). Null before first publish.
  current_revision_id uuid,
  status public.node_status not null default 'draft',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_paths_slug_lowercase check (slug = lower(slug))
);

-- Append-only version history + the path's metadata.
create table public.learning_path_revisions (
  id uuid primary key default gen_random_uuid(),
  learning_path_id uuid not null references public.learning_paths (id) on delete cascade,
  revision_number integer not null,
  title text,
  summary text,
  change_summary text,
  author_id uuid references public.profiles (id) on delete set null,
  status public.revision_status not null default 'draft',
  created_at timestamptz not null default now(),
  constraint learning_path_revisions_number_unique unique (learning_path_id, revision_number),
  -- Composite FK target for learning_paths.current_revision_id: constrains the
  -- live pointer to one of this path's own revisions.
  constraint learning_path_revisions_id_path_unique unique (id, learning_path_id)
);

create index learning_path_revisions_path_idx
  on public.learning_path_revisions (learning_path_id);

-- Path ↔ revision pointer cycle, so the FK is deferrable. Composite target
-- guarantees the live revision belongs to this path.
alter table public.learning_paths
  add constraint learning_paths_current_revision_id_fkey
  foreign key (current_revision_id, id) references public.learning_path_revisions (id, learning_path_id)
  on delete set null (current_revision_id)
  deferrable initially deferred;

-- The topics and targets this revision includes.
create table public.learning_path_revision_nodes (
  revision_id uuid not null references public.learning_path_revisions (id) on delete cascade,
  guide_base_id uuid not null,
  guide_id uuid not null,
  is_target boolean not null default false,
  note text,
  primary key (revision_id, guide_base_id),
  -- Composite FK pins the chosen variant to this base: guide_id must be a guide
  -- of guide_base_id.
  constraint learning_path_revision_nodes_variant_of_base
    foreign key (guide_id, guide_base_id) references public.guides (id, guide_base_id)
    on delete restrict
);

-- The frozen projection of guide_edges onto the included node set, computed once
-- at publish time.
create table public.learning_path_revision_edges (
  revision_id uuid not null,
  from_guide_base_id uuid not null,
  to_guide_base_id uuid not null,
  primary key (revision_id, from_guide_base_id, to_guide_base_id),
  -- Both endpoints must be included nodes of the same revision.
  constraint learning_path_revision_edges_from_is_node
    foreign key (revision_id, from_guide_base_id)
    references public.learning_path_revision_nodes (revision_id, guide_base_id)
    on delete cascade,
  constraint learning_path_revision_edges_to_is_node
    foreign key (revision_id, to_guide_base_id)
    references public.learning_path_revision_nodes (revision_id, guide_base_id)
    on delete cascade,
  constraint learning_path_revision_edges_no_self_loop
    check (from_guide_base_id <> to_guide_base_id)
);

create table public.learning_path_review_cases (
  case_id uuid primary key references public.review_cases (id) on delete cascade,
  learning_path_revision_id uuid not null
    references public.learning_path_revisions (id) on delete restrict
);

create index learning_path_review_cases_revision_idx
  on public.learning_path_review_cases (learning_path_revision_id);

create trigger learning_paths_touch_updated_at
  before update on public.learning_paths
  for each row execute function public.touch_updated_at();

-- Row-level security policies
alter table public.learning_paths enable row level security;
alter table public.learning_path_revisions enable row level security;
alter table public.learning_path_revision_nodes enable row level security;
alter table public.learning_path_revision_edges enable row level security;
alter table public.learning_path_review_cases enable row level security;

create policy "Published paths are viewable by everyone"
  on public.learning_paths for select
  using (status <> 'draft' or created_by = (select auth.uid()));

create policy "Authenticated users can create draft paths"
  on public.learning_paths for insert
  to authenticated
  with check (created_by = (select auth.uid()) and status = 'draft');

create policy "Curators can update their own paths except publishing"
  on public.learning_paths for update
  to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()) and status in ('draft', 'archived'));

create policy "Moderators can update paths except publishing"
  on public.learning_paths for update
  to authenticated
  using (public.has_role('moderator') or public.has_role('admin'))
  with check (
    (public.has_role('moderator') or public.has_role('admin'))
    and status in ('draft', 'archived')
  );

create policy "Submitted path revisions are viewable by everyone"
  on public.learning_path_revisions for select
  using (status = 'submitted' or author_id = (select auth.uid()));

create policy "Curators can create their own draft path revisions"
  on public.learning_path_revisions for insert
  to authenticated
  with check (author_id = (select auth.uid()) and status = 'draft');

create policy "Curators can edit and submit their own draft path revisions"
  on public.learning_path_revisions for update
  to authenticated
  using (author_id = (select auth.uid()) and status = 'draft')
  with check (author_id = (select auth.uid()));

create policy "Path nodes are viewable when their revision is"
  on public.learning_path_revision_nodes for select
  using (
    exists (
      select 1 from public.learning_path_revisions r
      where r.id = revision_id
        and (r.status = 'submitted' or r.author_id = (select auth.uid()))
    )
  );

create policy "Curators can edit nodes of their own draft revisions"
  on public.learning_path_revision_nodes for all
  to authenticated
  using (
    exists (
      select 1 from public.learning_path_revisions r
      where r.id = revision_id
        and r.author_id = (select auth.uid())
        and r.status = 'draft'
    )
  )
  with check (
    exists (
      select 1 from public.learning_path_revisions r
      where r.id = revision_id
        and r.author_id = (select auth.uid())
        and r.status = 'draft'
    )
  );

-- Edges are written only at publish (service role) because no user
-- should ever change an edge directly here, as learning path edges
-- are computed by the system, not the user.
create policy "Path edges are viewable when their revision is"
  on public.learning_path_revision_edges for select
  using (
    exists (
      select 1 from public.learning_path_revisions r
      where r.id = revision_id
        and (r.status = 'submitted' or r.author_id = (select auth.uid()))
    )
  );

create policy "Path review case links are viewable by everyone"
  on public.learning_path_review_cases for select
  using (true);

create policy "Submitters can link their case to its path revision"
  on public.learning_path_review_cases for insert
  to authenticated
  with check (
    exists (
      select 1 from public.review_cases rc
      where rc.id = case_id and rc.created_by = (select auth.uid())
    )
  );
