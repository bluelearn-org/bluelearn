-- Disclaimers are proposed per revision, like subject tags, and land on the
-- guide base when the revision is approved. guide_disclaimers stays the live
-- set the guide pages read.

create table public.guide_revision_disclaimers (
  guide_revision_id uuid not null references public.guide_revisions (id) on delete cascade,
  disclaimer_id uuid not null references public.disclaimers (id) on delete cascade,
  primary key (guide_revision_id, disclaimer_id)
);

comment on table public.guide_revision_disclaimers is 'Disclaimers a guide revision proposes for its guide base, applied on approval.';

alter table public.guide_revision_disclaimers enable row level security;

create policy "Guide revision disclaimers are viewable by everyone"
  on public.guide_revision_disclaimers for select
  using (true);

create policy "Authors can set disclaimers on their draft revisions"
  on public.guide_revision_disclaimers for insert
  to authenticated
  with check (
    exists (
      select 1 from public.guide_revisions r
      where r.id = guide_revision_disclaimers.guide_revision_id
        and r.author_id = (select auth.uid())
        and r.status = 'draft'
    )
  );

create policy "Authors can clear disclaimers on their draft revisions"
  on public.guide_revision_disclaimers for delete
  to authenticated
  using (
    exists (
      select 1 from public.guide_revisions r
      where r.id = guide_revision_disclaimers.guide_revision_id
        and r.author_id = (select auth.uid())
        and r.status = 'draft'
    )
  );

create policy "Active authors can insert revision disclaimers"
  on public.guide_revision_disclaimers as restrictive for insert to authenticated
  with check ((select public.is_active_guide_author()));

create policy "Active authors can delete revision disclaimers"
  on public.guide_revision_disclaimers as restrictive for delete to authenticated
  using ((select public.is_active_guide_author()));

-- Every revision starts from its base's live disclaimers, whichever path
-- created it (create_guide, create_variant, revision forks, rollbacks).
create or replace function public.seed_revision_disclaimers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.guide_revision_disclaimers (guide_revision_id, disclaimer_id)
    select new.id, gd.disclaimer_id
      from public.guides g
      join public.guide_disclaimers gd on gd.guide_base_id = g.guide_base_id
      where g.id = new.guide_id
  on conflict do nothing;

  return new;
end;
$$;

create trigger guide_revisions_seed_disclaimers
  after insert on public.guide_revisions
  for each row execute function public.seed_revision_disclaimers();

-- Existing revisions take their base's current set, the best record there is.
insert into public.guide_revision_disclaimers (guide_revision_id, disclaimer_id)
  select gr.id, gd.disclaimer_id
    from public.guide_revisions gr
    join public.guides g on g.id = gr.guide_id
    join public.guide_disclaimers gd on gd.guide_base_id = g.guide_base_id
on conflict do nothing;

-- A fork of a rejected revision keeps the disclaimers it proposed rather than
-- the base's.
create or replace function public.revise_guide_revision(p_revision_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_new_id uuid;
begin
  -- Closed cases are publicly-readable, so the author check is what stops a stranger
  -- from forking someone else's rejected work.
  perform 1
    from public.guide_revisions gr
    join public.guide_review_cases grc on grc.guide_revision_id = gr.id
    join public.review_cases rc on rc.id = grc.case_id
    where gr.id = p_revision_id
      and gr.author_id = (select auth.uid())
      and rc.status = 'rejected';

  if not found then
    raise exception 'Revision not found or not a rejected submission'
      using errcode = 'no_data_found';
  end if;

  begin
    insert into public.guide_revisions (
      guide_id, title, summary, body, change_summary,
      author_id, status, revised_from_revision_id
    )
    select
      gr.guide_id,
      gr.title, gr.summary, gr.body, gr.change_summary,
      (select auth.uid()), 'draft', gr.id
    from public.guide_revisions gr
    where gr.id = p_revision_id
    returning id into v_new_id;
  exception when unique_violation then
    -- A draft is already open for this rejection, so resume that one.
    select id into v_new_id
      from public.guide_revisions
      where revised_from_revision_id = p_revision_id
        and status = 'draft'
      limit 1;

    return v_new_id;
  end;

  insert into public.guide_revision_subjects (guide_revision_id, subject_id)
    select v_new_id, subject_id
      from public.guide_revision_subjects
      where guide_revision_id = p_revision_id;

  delete from public.guide_revision_disclaimers
    where guide_revision_id = v_new_id;
  insert into public.guide_revision_disclaimers (guide_revision_id, disclaimer_id)
    select v_new_id, disclaimer_id
      from public.guide_revision_disclaimers
      where guide_revision_id = p_revision_id;

  return v_new_id;
end;
$$;

grant execute on function public.revise_guide_revision(uuid) to authenticated;

-- Same as before, plus: an approved revision's disclaimers replace its base's.
create or replace function public.close_review_panel(p_case_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_panel_id uuid;
  v_target integer;
  v_case_type public.case_type;
  v_threshold integer;
  v_approve integer;
  v_reject integer;
  v_outcome public.review_outcome;
  v_revision_id uuid;
  v_guide_id uuid;
  v_base_id uuid;
  v_base_slug text;
  v_title text;
  v_slug_base text;
  v_slug text;
  v_suffix integer;
  v_subject record;
begin
  select rp.id, rp.target_seat_count, rc.case_type
    into v_panel_id, v_target, v_case_type
    from public.review_panels rp
    join public.review_cases rc on rc.id = rp.case_id
    where rp.case_id = p_case_id and rp.closed_at is null
    for update of rp;

  if not found then
    return;
  end if;

  v_threshold := case
    when v_case_type in ('official_publish', 'official_edit') then 2
    else v_target / 2 + 1
  end;

  select
    count(*) filter (where d.decision = 'approved'),
    count(*) filter (where d.decision = 'rejected')
    into v_approve, v_reject
    from public.panel_members pm
    join public.review_decisions d on d.panel_member_id = pm.id
    where pm.panel_id = v_panel_id;

  if v_approve >= v_threshold then
    v_outcome := 'approved';
  elsif v_reject >= v_threshold then
    v_outcome := 'rejected';
  else
    return;
  end if;

  update public.review_panels
    set outcome = v_outcome, closed_at = now()
    where id = v_panel_id;

  update public.review_cases
    set status = v_outcome::text::public.case_status
    where id = p_case_id;

  if v_outcome <> 'approved' then
    return;
  end if;

  select grc.guide_revision_id, gr.guide_id, g.guide_base_id, gr.title, b.slug
    into v_revision_id, v_guide_id, v_base_id, v_title, v_base_slug
    from public.guide_review_cases grc
    join public.guide_revisions gr on gr.id = grc.guide_revision_id
    join public.guides g on g.id = gr.guide_id
    join public.guide_bases b on b.id = g.guide_base_id
    where grc.case_id = p_case_id;

  update public.guide_revisions
    set approved_at = now()
    where id = v_revision_id;

  if v_case_type in ('guide_publish', 'official_publish') then
    v_slug_base := lower(
      trim(both '-' from regexp_replace(coalesce(v_title, ''), '[^a-zA-Z0-9]+', '-', 'g'))
    );
    if v_slug_base = '' then
      v_slug_base := 'guide';
    end if;
    v_slug := v_slug_base;
    v_suffix := 1;
    while exists (
      select 1 from public.guides
      where guide_base_id = v_base_id and slug = v_slug and id <> v_guide_id
    ) loop
      v_suffix := v_suffix + 1;
      v_slug := v_slug_base || '-' || v_suffix;
    end loop;

    update public.guides
      set current_revision_id = v_revision_id,
          status = 'published',
          slug = coalesce(slug, v_slug)
      where id = v_guide_id;

    if v_base_slug is null then
      v_slug := v_slug_base;
      v_suffix := 1;
      while exists (
        select 1 from public.guide_bases where slug = v_slug and id <> v_base_id
      ) loop
        v_suffix := v_suffix + 1;
        v_slug := v_slug_base || '-' || v_suffix;
      end loop;
      v_base_slug := v_slug;
    end if;

    update public.guide_bases
      set status = 'published',
          canonical_guide_id = coalesce(canonical_guide_id, v_guide_id),
          slug = coalesce(slug, v_base_slug)
      where id = v_base_id;

    update public.requests
      set status = 'resolved',
          resolved_guide_base_id = v_base_id
      where status = 'open'
        and id in (
          select tc.todo_id
          from public.request_claims tc
          where tc.guide_base_id = v_base_id
        );
  else
    update public.guides
      set current_revision_id = v_revision_id
      where id = v_guide_id;
  end if;

  delete from public.guide_disclaimers
    where guide_base_id = v_base_id;
  insert into public.guide_disclaimers (guide_base_id, disclaimer_id)
    select v_base_id, disclaimer_id
      from public.guide_revision_disclaimers
      where guide_revision_id = v_revision_id;

  for v_subject in
    select s.id, s.name
      from public.subjects s
      join public.guide_revision_subjects grs on grs.subject_id = s.id
      where grs.guide_revision_id = v_revision_id
        and s.slug is null
      for update of s
  loop
    v_slug_base := lower(
      trim(both '-' from regexp_replace(coalesce(v_subject.name, ''), '[^a-zA-Z0-9]+', '-', 'g'))
    );
    if v_slug_base = '' then
      v_slug_base := 'subject';
    end if;
    v_slug := v_slug_base;
    v_suffix := 1;
    while exists (
      select 1 from public.subjects where slug = v_slug
    ) loop
      v_suffix := v_suffix + 1;
      v_slug := v_slug_base || '-' || v_suffix;
    end loop;

    update public.subjects set slug = v_slug where id = v_subject.id;
  end loop;

  update public.subjects s
    set status = 'published'
    from public.guide_revision_subjects grs
    where grs.guide_revision_id = v_revision_id
      and grs.subject_id = s.id
      and s.status <> 'published';
end;
$$;
