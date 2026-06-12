-- Case types share one root (review_cases) + one panel
-- table + one decision table. Type-specific fields hang off the root in 1:1
-- satellite tables keyed on case_id. v1 ships verifier gates only; re-reviews,
-- disputes, and appeals add their case_type values + satellites later.

create type public.case_type as enum (
  'guide_publish',
  'guide_edit'
);

create type public.case_status as enum ('pending', 'in_review', 'approved', 'rejected');

-- Shared by a panel's majority outcome and an individual member's decision
create type public.review_outcome as enum ('approved', 'rejected');

create type public.seat_status as enum ('assigned', 'recused', 'replaced', 'completed');

-- Rubric a rejecting reviewer cites; a rejected decision needs >= 1.
create type public.decision_reason as enum (
  'hierarchy_issue',
  'factual_error',
  'duplicate_content',
  'scope_violation',
  'clarity_issue',
  'missing_required_information'
);

create table public.review_cases (
  id uuid primary key default gen_random_uuid(),
  case_type public.case_type not null,
  status public.case_status not null default 'pending',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  time_limit interval
);

create trigger review_cases_touch_updated_at
  before update on public.review_cases
  for each row execute function public.touch_updated_at();

-- An odd-numbered random panel deciding a case. One case may have many panels
-- over its lifetime, so both case and panel carry their own status/outcome.
-- The panels -> seats -> decisions chain is the governance audit trail, so
-- every FK in it restricts: a parent with history cannot be hard-deleted.
create table public.review_panels (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.review_cases (id) on delete restrict,
  target_seat_count integer not null,
  outcome public.review_outcome,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint review_panels_seat_count_odd check (target_seat_count % 2 = 1)
);

create index review_panels_case_id_idx on public.review_panels (case_id);

create table public.panel_members (
  id uuid primary key default gen_random_uuid(),
  panel_id uuid not null references public.review_panels (id) on delete restrict,
  member_id uuid references public.profiles (id) on delete set null,
  status public.seat_status not null default 'assigned',
  assigned_at timestamptz not null default now(),
  -- Replacements are drawn from the pool minus those already seated, so one
  -- member never holds two seats on the same panel.
  constraint panel_members_one_seat_per_member unique (panel_id, member_id)
);

create index panel_members_member_id_idx on public.panel_members (member_id);

create table public.review_decisions (
  id uuid primary key default gen_random_uuid(),
  panel_member_id uuid not null unique references public.panel_members (id) on delete restrict,
  decision public.review_outcome not null,
  notes text,
  created_at timestamptz not null default now()
);

-- A decision may cite several rubric reasons at once. A rejected decision needs
-- >= 1 row here; an approved one has none (enforced in the app layer).
create table public.review_decision_reasons (
  decision_id uuid not null references public.review_decisions (id) on delete cascade,
  reason public.decision_reason not null,
  primary key (decision_id, reason)
);

-- guide_publish + guide_edit: pins the panel to the exact revision it judged.
-- restrict: a reviewed revision (and everything upstream of it) cannot be
-- hard-deleted without explicitly confronting the review history; content
-- removal is the is_purged flag, never row deletion.
create table public.guide_review_cases (
  case_id uuid primary key references public.review_cases (id) on delete cascade,
  guide_revision_id uuid not null references public.guide_revisions (id) on delete restrict
);

create index guide_review_cases_revision_idx on public.guide_review_cases (guide_revision_id);

-- Row-level security policies
alter table public.review_cases enable row level security;
alter table public.review_panels enable row level security;
alter table public.panel_members enable row level security;
alter table public.review_decisions enable row level security;
alter table public.review_decision_reasons enable row level security;
alter table public.guide_review_cases enable row level security;

create policy "Review cases are viewable by everyone"
  on public.review_cases for select
  using (true);

create policy "Users can open cases they submit"
  on public.review_cases for insert
  to authenticated
  with check (created_by = (select auth.uid()) and status = 'pending');

create policy "Review panels are viewable by everyone"
  on public.review_panels for select
  using (true);

create policy "Panel seats are viewable by everyone"
  on public.panel_members for select
  using (true);

create policy "Review decisions are viewable by everyone"
  on public.review_decisions for select
  using (true);

create policy "Panelists can cast their own decision"
  on public.review_decisions for insert
  to authenticated
  with check (
    exists (
      select 1 from public.panel_members pm
      where pm.id = panel_member_id
        and pm.member_id = (select auth.uid())
        and pm.status = 'assigned'
    )
  );

create policy "Decision reasons are viewable by everyone"
  on public.review_decision_reasons for select
  using (true);

create policy "Panelists can cite reasons on their own decision"
  on public.review_decision_reasons for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.review_decisions d
      join public.panel_members pm on pm.id = d.panel_member_id
      where d.id = decision_id and pm.member_id = (select auth.uid())
    )
  );

create policy "Guide review case links are viewable by everyone"
  on public.guide_review_cases for select
  using (true);

create policy "Submitters can link their case to its revision"
  on public.guide_review_cases for insert
  to authenticated
  with check (
    exists (
      select 1 from public.review_cases rc
      where rc.id = case_id and rc.created_by = (select auth.uid())
    )
  );
