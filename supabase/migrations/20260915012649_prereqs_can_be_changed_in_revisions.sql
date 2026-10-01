create table if not exists public.guide_revision_edges(
  guide_revision_id uuid not null
    references public.guide_revisions(id) on delete cascade,
  new_edge_id uuid not null
    references public.guide_bases(id) on delete cascade, 
  primary key (guide_revision_id, new_edge_id)
);

alter table public.guide_revision_edges enable row level security;

create policy "Authors can manage edges for their own draft"
on public.guide_revision_edges
for all
to authenticated
using (
  exists (
    select 1 from public.guide_revisions r
    where r.id = guide_revision_id
      and r.author_id = auth.uid()
      and r.status = 'draft'
  )
)
with check (
  exists (
    select 1 from public.guide_revisions r
    where r.id = guide_revision_id
      and r.author_id = auth.uid()
      and r.status = 'draft'
  )
);

create policy "Edges are visible after submission, always visible to author"
on public.guide_revision_edges
for select
to authenticated
using (
  exists (
    select 1 from public.guide_revisions r
    where r.id = guide_revision_id
      and (r.author_id = auth.uid() or r.status != 'draft')
  )
);

create table if not exists public.guide_revision_requests(
  id uuid primary key default gen_random_uuid(),
  guide_revision_id uuid not null
    references public.guide_revisions(id) on delete cascade,
  title text not null,
  summary text not null
);

alter table public.guide_revision_requests enable row level security;

create policy "Authors can manage requests for their own draft"
on public.guide_revision_requests
for all
to authenticated
using (
  exists (
    select 1 from public.guide_revisions r
    where r.id = guide_revision_id
      and r.author_id = auth.uid()
      and r.status = 'draft'
  )
)
with check (
  exists (
    select 1 from public.guide_revisions r
    where r.id = guide_revision_id
      and r.author_id = auth.uid()
      and r.status = 'draft'
  )
);

create policy "Requests are visible after submission, always visible to author"
on public.guide_revision_requests
for select
to authenticated
using (
  exists (
    select 1 from public.guide_revisions r
    where r.id = guide_revision_id
      and (r.author_id = auth.uid() or r.status != 'draft')
  )
);

create or replace function public.apply_revision_edges_and_requests(
  p_revision_id uuid,
  p_base_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.guide_edges
  where to_guide_base_id = p_base_id
    and edge_type = 'prerequisite';

  insert into public.guide_edges (from_guide_base_id, to_guide_base_id, edge_type)
  select new_edge_id, p_base_id, 'prerequisite'
  from public.guide_revision_edges
  where guide_revision_id = p_revision_id;

  delete from public.requests
  where dependent_guide_base_id = p_base_id
    and status = 'open'; -- Cannot delete a resolved request
  
  insert into public.requests (dependent_guide_base_id, title, summary, status)
  select p_base_id, title, summary, 'open'
  from public.guide_revision_requests
  where guide_revision_id = p_revision_id;
end;
$$;

revoke execute on function public.apply_revision_edges_and_requests(uuid, uuid)
  from public, authenticated;

-- Same as previous close_review_panel but now calls apply_revision_edges_and_requests
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

  perform public.apply_revision_edges_and_requests(v_revision_id, v_base_id);

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

grant execute on function public.close_review_panel(uuid) to authenticated, service_role;
