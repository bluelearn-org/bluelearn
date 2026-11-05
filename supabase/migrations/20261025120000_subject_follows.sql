create table public.subject_follows (
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  primary key (user_id, subject_id)
);

-- The primary key covers owner lookups; this index covers subject deletion.
create index subject_follows_subject_id_idx on public.subject_follows (subject_id);

alter table public.subject_follows enable row level security;

revoke all on public.subject_follows from anon, authenticated;
grant select, insert, delete on public.subject_follows to authenticated;
grant all on public.subject_follows to service_role;

create policy "Users can read their own subject follows"
  on public.subject_follows for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can follow published subjects for themselves"
  on public.subject_follows for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.subjects
      where id = subject_id and status = 'published' and slug is not null
    )
  );

create policy "Users can remove their own subject follows"
  on public.subject_follows for delete to authenticated
  using (user_id = (select auth.uid()));
