-- Move subject tags from the node (guide_base / objective) to the revision.
-- A guide base's live tags resolve through its canonical variant's current
-- revision.

drop table public.guide_subjects;
drop table public.objective_subjects;

create table public.guide_revision_subjects (
  guide_revision_id uuid not null references public.guide_revisions (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  primary key (guide_revision_id, subject_id)
);

create index guide_revision_subjects_subject_id_idx
  on public.guide_revision_subjects (subject_id);

create table public.objective_revision_subjects (
  objective_revision_id uuid not null references public.objective_revisions (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  primary key (objective_revision_id, subject_id)
);

create index objective_revision_subjects_subject_id_idx
  on public.objective_revision_subjects (subject_id);

alter table public.guide_revision_subjects enable row level security;
alter table public.objective_revision_subjects enable row level security;

create policy "Guide revision subject tags are viewable by everyone"
  on public.guide_revision_subjects for select
  using (true);

create policy "Authors can tag their draft revisions"
  on public.guide_revision_subjects for insert
  to authenticated
  with check (
    exists (
      select 1 from public.guide_revisions r
      where r.id = guide_revision_subjects.guide_revision_id
        and r.author_id = (select auth.uid())
        and r.status = 'draft'
    )
  );

create policy "Authors can untag their draft revisions"
  on public.guide_revision_subjects for delete
  to authenticated
  using (
    exists (
      select 1 from public.guide_revisions r
      where r.id = guide_revision_subjects.guide_revision_id
        and r.author_id = (select auth.uid())
        and r.status = 'draft'
    )
  );

create policy "Objective revision subject tags are viewable by everyone"
  on public.objective_revision_subjects for select
  using (true);

create policy "Authors can tag their draft objective revisions"
  on public.objective_revision_subjects for insert
  to authenticated
  with check (
    exists (
      select 1 from public.objective_revisions r
      where r.id = objective_revision_subjects.objective_revision_id
        and r.author_id = (select auth.uid())
        and r.status = 'draft'
    )
  );

create policy "Authors can untag their draft objective revisions"
  on public.objective_revision_subjects for delete
  to authenticated
  using (
    exists (
      select 1 from public.objective_revisions r
      where r.id = objective_revision_subjects.objective_revision_id
        and r.author_id = (select auth.uid())
        and r.status = 'draft'
    )
  );
