-- Same as 20261107120000_guide_scoped_disclaimers, plus the verifier edits
-- from 20261018120000_review_threads_and_suggestions. A revision made from
-- accepted edits keeps the disclaimers of the revision it edits.
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
  v_reviewed_id uuid;
  v_guide_id uuid;
  v_base_id uuid;
  v_base_slug text;
  v_title text;
  v_slug_base text;
  v_slug text;
  v_suffix integer;
  v_subject record;
  v_edit record;
  v_original text;
  v_body text;
  v_from integer;
  v_to integer;
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

  -- Pending edits delay approval only; rejection needs no author decision.
  if v_outcome = 'approved' and exists (
    select 1
      from public.review_suggestions s
      where s.case_id = p_case_id and s.status = 'pending'
  ) then
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

  if exists (
    select 1
      from public.review_suggestions s
      where s.case_id = p_case_id and s.status = 'accepted'
  ) then
    v_reviewed_id := v_revision_id;
    select gr.body into v_original
      from public.guide_revisions gr
      where gr.id = v_reviewed_id;
    v_body := v_original;

    -- Back to front, so each splice leaves the offsets of the earlier ones intact.
    for v_edit in
      select s.id, s.source_start, s.source_end, s.source_text, s.proposed
        from public.review_suggestions s
        where s.case_id = p_case_id and s.status = 'accepted'
        order by s.source_start desc
    loop
      v_from := public.utf16_char_offset(v_original, v_edit.source_start);
      v_to := public.utf16_char_offset(v_original, v_edit.source_end);

      if v_from is null
         or v_to is null
         or substr(v_original, v_from + 1, v_to - v_from) is distinct from v_edit.source_text then
        raise exception 'Accepted edit % no longer matches its revision', v_edit.id
          using errcode = 'data_corrupted';
      end if;

      v_body := overlay(v_body placing v_edit.proposed from v_from + 1 for v_to - v_from);
    end loop;

    -- Keep accepted edits strictly later in history so the diff isolates them.
    insert into public.guide_revisions (
      guide_id, title, summary, body, change_summary, author_id, status, approved_at
    )
    select
      gr.guide_id, gr.title, gr.summary, v_body, 'Accepted reviewer edits',
      gr.author_id, 'submitted',
      greatest(clock_timestamp(), now() + interval '1 microsecond')
    from public.guide_revisions gr
    where gr.id = v_reviewed_id
    returning id into v_revision_id;

    insert into public.guide_revision_subjects (guide_revision_id, subject_id)
      select v_revision_id, grs.subject_id
        from public.guide_revision_subjects grs
        where grs.guide_revision_id = v_reviewed_id;

    -- The insert trigger seeds the live guide's set; use the reviewed revision's.
    delete from public.guide_revision_disclaimers
      where guide_revision_id = v_revision_id;
    insert into public.guide_revision_disclaimers (guide_revision_id, disclaimer_id)
      select v_revision_id, disclaimer_id
        from public.guide_revision_disclaimers
        where guide_revision_id = v_reviewed_id;

    -- Register verifier-added media here so revision purges cannot delete it.
    -- Storage-key matching scans media_assets on each publication.
    insert into public.revision_assets (revision_id, asset_id)
      select v_revision_id, ra.asset_id
        from public.revision_assets ra
        where ra.revision_id = v_reviewed_id
      union
      select v_revision_id, ma.id
        from public.media_assets ma
        where strpos(v_body, ma.storage_key) > 0
      on conflict do nothing;

    update public.review_suggestions
      set applied_revision_id = v_revision_id
      where case_id = p_case_id and status = 'accepted';
  end if;

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
