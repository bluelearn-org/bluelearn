-- Disclaimers belong to each guide (the original or a variant), not to the
-- guide base they share. Approving a variant's revision used to replace the
-- base's set, which changed the banners on every other guide under that base.

-- 1. Move guide_disclaimers from guide_base_id to guide_id. Every existing
--    guide keeps the set its base had, so nothing changes on screen.
alter table public.guide_disclaimers drop constraint guide_disclaimers_pkey;
alter table public.guide_disclaimers
  add column guide_id uuid references public.guides (id) on delete cascade;

insert into public.guide_disclaimers (guide_base_id, guide_id, disclaimer_id)
  select gd.guide_base_id, g.id, gd.disclaimer_id
    from public.guide_disclaimers gd
    join public.guides g on g.guide_base_id = gd.guide_base_id
    where gd.guide_id is null;

delete from public.guide_disclaimers where guide_id is null;

drop index if exists public.idx_guide_disclaimers_base;
alter table public.guide_disclaimers drop column guide_base_id;
alter table public.guide_disclaimers alter column guide_id set not null;
alter table public.guide_disclaimers add primary key (guide_id, disclaimer_id);

comment on table public.guide_disclaimers is 'The live disclaimer set of each guide (original or variant). Written when a revision of that guide is approved.';
comment on table public.guide_revision_disclaimers is 'Disclaimers a guide revision proposes for its guide, applied on approval.';

-- 2. A revision of a guide that is already live starts from that guide's set.
--    The first revision of a new variant has no set of its own yet, so it
--    starts from the base's canonical guide, the one the variant is based on.
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
      join public.guide_bases b on b.id = g.guide_base_id
      join public.guide_disclaimers gd
        on gd.guide_id = case
          when g.current_revision_id is not null then g.id
          else coalesce(b.canonical_guide_id, g.id)
        end
      where g.id = new.guide_id
  on conflict do nothing;

  return new;
end;
$$;

-- 3. Same as before, except an approved revision's disclaimers replace only
--    its own guide's set.
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
    where guide_id = v_guide_id;
  insert into public.guide_disclaimers (guide_id, disclaimer_id)
    select v_guide_id, disclaimer_id
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
