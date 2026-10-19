-- Panel feedback pinned to the exact revision a case judges. Threads carry the
-- discussion; suggestions carry verifier edits, which go live only after the
-- revision's author accepts them.

create type public.review_anchor_kind as enum ('passage', 'block');

create type public.review_suggestion_status as enum ('pending', 'accepted', 'rejected');

-- source_start/source_end count UTF-16 code units of the revision body, the
-- unit the reader's Markdown positions use; source_text is the server's own
-- slice. Block indexes and rendered-text offsets are the reader's coordinates.
create table public.review_threads (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.review_cases (id) on delete restrict,
  revision_id uuid not null references public.guide_revisions (id) on delete restrict,
  author_id uuid references public.profiles (id) on delete set null,
  anchor_kind public.review_anchor_kind not null,
  start_block integer not null,
  start_offset integer not null,
  end_block integer not null,
  end_offset integer not null,
  quote text not null,
  source_start integer,
  source_end integer,
  source_text text,
  body text not null,
  created_at timestamptz not null default now(),
  constraint review_threads_anchor_valid check (
    start_block >= 0
    and start_offset >= 0
    and end_offset >= 0
    and end_block between start_block and 10000
    and (end_block > start_block or end_offset >= start_offset)
    and char_length(quote) <= 2000
    and (anchor_kind = 'passage' or (start_block = end_block and start_offset = 0))
  ),
  constraint review_threads_source_valid check (
    (source_start is null and source_end is null and source_text is null)
    or (source_start >= 0 and source_end > source_start and source_text is not null)
  ),
  constraint review_threads_body_length check (
    char_length(btrim(body)) between 1 and 10000
  )
);

create index review_threads_case_id_idx on public.review_threads (case_id);

create table public.review_thread_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.review_threads (id) on delete restrict,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint review_thread_replies_body_length check (
    char_length(btrim(body)) between 1 and 10000
  )
);

create index review_thread_replies_thread_id_idx
  on public.review_thread_replies (thread_id);

-- A suggestion replaces one whole block. applied_revision_id is the revision
-- that went live carrying the edit, so reviewer attribution outlives the case.
create table public.review_suggestions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.review_cases (id) on delete restrict,
  revision_id uuid not null references public.guide_revisions (id) on delete restrict,
  author_id uuid references public.profiles (id) on delete set null,
  block_index integer not null,
  block_length integer not null,
  quote text not null,
  source_start integer not null,
  source_end integer not null,
  source_text text not null,
  proposed text not null,
  note text,
  status public.review_suggestion_status not null default 'pending',
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  applied_revision_id uuid references public.guide_revisions (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint review_suggestions_anchor_valid check (
    block_index between 0 and 10000
    and block_length >= 0
    and char_length(quote) <= 2000
    and source_start >= 0
    and source_end > source_start
  ),
  constraint review_suggestions_changes_text check (proposed <> source_text),
  constraint review_suggestions_text_length check (
    char_length(proposed) <= 20000
    and (note is null or char_length(btrim(note)) between 1 and 10000)
  ),
  constraint review_suggestions_decided check (
    (status = 'pending') = (decided_at is null)
  ),
  constraint review_suggestions_applied_when_accepted check (
    applied_revision_id is null or status = 'accepted'
  )
);

create index review_suggestions_case_id_idx
  on public.review_suggestions (case_id, status);

-- Open-case feedback is private to the author and the seated panel, and
-- close_review_panel trusts suggestion status, so clients get no direct table
-- access: the API reads with the service role after the same visibility check
-- as getReviewCase, and every write goes through the functions below.
alter table public.review_threads enable row level security;
alter table public.review_thread_replies enable row level security;
alter table public.review_suggestions enable row level security;

revoke all on public.review_threads, public.review_thread_replies, public.review_suggestions
  from anon, authenticated;

-- Browsers count string offsets in UTF-16 code units, Postgres in characters.
-- They differ only after astral characters (emoji, math letters). Returns null
-- for an offset past the end or inside a surrogate pair.
create or replace function public.utf16_char_offset(p_text text, p_units integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_text is null or p_units is null or p_units < 0 then null
    when p_units = 0 then 0
    when octet_length(p_text) = char_length(p_text) then
      case when p_units <= char_length(p_text) then p_units end
    else (
      select u.ord::integer
        from (
          select t.ord,
                 sum(case when ascii(t.ch) > 65535 then 2 else 1 end)
                   over (order by t.ord) as units
            from string_to_table(p_text, null) with ordinality as t(ch, ord)
        ) u
        where u.units = p_units
    )
  end;
$$;

revoke execute on function public.utf16_char_offset(text, integer)
  from public, anon, authenticated;

-- The body slice an anchor covers, or null when the range is out of bounds,
-- blank, or not on line edges. Only indentation may precede it and only
-- trailing blanks may follow it, so an accepted edit never splices into a word.
create or replace function public.review_anchor_source(
  p_body text,
  p_start integer,
  p_end integer
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_from integer := public.utf16_char_offset(p_body, p_start);
  v_to integer := public.utf16_char_offset(p_body, p_end);
  v_source text;
begin
  if v_from is null or v_to is null or v_to <= v_from then
    return null;
  end if;

  v_source := substr(p_body, v_from + 1, v_to - v_from);
  if btrim(v_source, E' \t\r\n') = '' then
    return null;
  end if;

  if substring(left(p_body, v_from) from '[^\n]*$') !~ '^[ \t]*$'
     or substring(substr(p_body, v_to + 1) from '^[^\n]*') !~ '^[ \t\r]*$' then
    return null;
  end if;

  return v_source;
end;
$$;

revoke execute on function public.review_anchor_source(text, integer, integer)
  from public, anon, authenticated;

-- Same seat rule as cast_review_decision: an assigned seat counts until it
-- expires, a completed seat keeps its voice.
create or replace function public.has_live_review_seat(
  p_panel_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
      from public.panel_members pm
      where pm.panel_id = p_panel_id
        and pm.member_id = p_user_id
        and (
          pm.status = 'completed'
          or (
            pm.status = 'assigned'
            and (pm.expires_at is null or now() <= pm.expires_at)
          )
        )
  );
$$;

revoke execute on function public.has_live_review_seat(uuid, uuid)
  from public, anon, authenticated;

-- The open panel row is the publication lock. close_review_panel takes it too,
-- so feedback can never land beside the vote or answer that publishes.
create or replace function public.lock_open_review_case(p_case_id uuid)
returns table (panel_id uuid, revision_id uuid, revision_author_id uuid, body text)
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.review_cases rc where rc.id = p_case_id;
  if not found then
    raise exception 'Review case not found' using errcode = 'no_data_found';
  end if;

  return query
    select rp.id, gr.id, gr.author_id, gr.body
      from public.review_panels rp
      join public.review_cases rc on rc.id = rp.case_id
      join public.guide_review_cases grc on grc.case_id = rc.id
      join public.guide_revisions gr on gr.id = grc.guide_revision_id
      where rp.case_id = p_case_id
        and rp.closed_at is null
        and rc.status = 'in_review'
      for update of rp;

  if not found then
    raise exception 'This review case is not open for feedback'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
end;
$$;

revoke execute on function public.lock_open_review_case(uuid)
  from public, anon, authenticated;

create or replace function public.create_review_thread(
  p_case_id uuid,
  p_revision_id uuid,
  p_anchor_kind public.review_anchor_kind,
  p_start_block integer,
  p_start_offset integer,
  p_end_block integer,
  p_end_offset integer,
  p_quote text,
  p_body text,
  p_source_start integer default null,
  p_source_end integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case record;
  v_source text;
  v_id uuid;
begin
  select * into v_case from public.lock_open_review_case(p_case_id);

  if not public.has_live_review_seat(v_case.panel_id, (select auth.uid())) then
    raise exception 'Only panelists with a live seat can comment on this case'
      using errcode = 'insufficient_privilege';
  end if;
  if not public.is_active_guide_author() then
    raise exception 'Suspended users cannot take part in reviews'
      using errcode = 'insufficient_privilege';
  end if;
  if p_revision_id is distinct from v_case.revision_id then
    raise exception 'This anchor belongs to a different revision of the guide'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  if p_source_start is not null or p_source_end is not null then
    v_source := public.review_anchor_source(v_case.body, p_source_start, p_source_end);
    if v_source is null then
      raise exception 'The anchor does not match this revision''s text'
        using errcode = 'data_exception';
    end if;
  end if;

  insert into public.review_threads (
    case_id, revision_id, author_id, anchor_kind,
    start_block, start_offset, end_block, end_offset, quote,
    source_start, source_end, source_text, body
  )
  values (
    p_case_id, v_case.revision_id, (select auth.uid()), p_anchor_kind,
    p_start_block, p_start_offset, p_end_block, p_end_offset, p_quote,
    p_source_start, p_source_end, v_source, p_body
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.create_review_thread(
  uuid, uuid, public.review_anchor_kind, integer, integer, integer, integer,
  text, text, integer, integer
) from public, anon;
grant execute on function public.create_review_thread(
  uuid, uuid, public.review_anchor_kind, integer, integer, integer, integer,
  text, text, integer, integer
) to authenticated;

create or replace function public.reply_review_thread(
  p_case_id uuid,
  p_thread_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case record;
  v_id uuid;
begin
  perform 1
    from public.review_threads t
    where t.id = p_thread_id and t.case_id = p_case_id;
  if not found then
    raise exception 'Thread not found' using errcode = 'no_data_found';
  end if;

  select * into v_case from public.lock_open_review_case(p_case_id);

  if v_case.revision_author_id is distinct from (select auth.uid())
     and not public.has_live_review_seat(v_case.panel_id, (select auth.uid())) then
    raise exception 'Only the author and panelists with a live seat can reply'
      using errcode = 'insufficient_privilege';
  end if;
  if not public.is_active_guide_author() then
    raise exception 'Suspended users cannot take part in reviews'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.review_thread_replies (thread_id, author_id, body)
    values (p_thread_id, (select auth.uid()), p_body)
    returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.reply_review_thread(uuid, uuid, text)
  from public, anon;
grant execute on function public.reply_review_thread(uuid, uuid, text)
  to authenticated;

create or replace function public.create_review_suggestion(
  p_case_id uuid,
  p_revision_id uuid,
  p_block_index integer,
  p_block_length integer,
  p_quote text,
  p_source_start integer,
  p_source_end integer,
  p_proposed text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case record;
  v_source text;
  v_id uuid;
begin
  select * into v_case from public.lock_open_review_case(p_case_id);

  if not public.has_live_review_seat(v_case.panel_id, (select auth.uid())) then
    raise exception 'Only panelists with a live seat can comment on this case'
      using errcode = 'insufficient_privilege';
  end if;
  if not public.is_active_guide_author() then
    raise exception 'Suspended users cannot take part in reviews'
      using errcode = 'insufficient_privilege';
  end if;
  if p_revision_id is distinct from v_case.revision_id then
    raise exception 'This anchor belongs to a different revision of the guide'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  v_source := public.review_anchor_source(v_case.body, p_source_start, p_source_end);
  if v_source is null then
    raise exception 'The anchor does not match this revision''s text'
      using errcode = 'data_exception';
  end if;
  if p_proposed = v_source then
    raise exception 'The proposed text matches the original'
      using errcode = 'data_exception';
  end if;

  insert into public.review_suggestions (
    case_id, revision_id, author_id, block_index, block_length, quote,
    source_start, source_end, source_text, proposed, note
  )
  values (
    p_case_id, v_case.revision_id, (select auth.uid()), p_block_index,
    p_block_length, p_quote, p_source_start, p_source_end, v_source,
    p_proposed, nullif(btrim(p_note), '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.create_review_suggestion(
  uuid, uuid, integer, integer, text, integer, integer, text, text
) from public, anon;
grant execute on function public.create_review_suggestion(
  uuid, uuid, integer, integer, text, integer, integer, text, text
) to authenticated;

-- The author's answer to one verifier edit. Every answer reruns the tally;
-- close_review_panel stops before publication while any edit is pending, so
-- the answer that clears the last one publishes a waiting approval right here.
create or replace function public.decide_review_suggestion(
  p_case_id uuid,
  p_suggestion_id uuid,
  p_decision public.review_suggestion_status
)
returns public.case_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case record;
  v_suggestion record;
  v_status public.case_status;
begin
  if p_decision is null or p_decision = 'pending' then
    raise exception 'A suggestion can only be accepted or rejected'
      using errcode = 'invalid_parameter_value';
  end if;

  perform 1
    from public.review_suggestions s
    where s.id = p_suggestion_id and s.case_id = p_case_id;
  if not found then
    raise exception 'Suggestion not found' using errcode = 'no_data_found';
  end if;

  select * into v_case from public.lock_open_review_case(p_case_id);

  if v_case.revision_author_id is distinct from (select auth.uid()) then
    raise exception 'Only the guide author can accept or reject suggested edits'
      using errcode = 'insufficient_privilege';
  end if;
  if not public.is_active_guide_author() then
    raise exception 'Suspended users cannot take part in reviews'
      using errcode = 'insufficient_privilege';
  end if;

  select s.status, s.source_start, s.source_end
    into v_suggestion
    from public.review_suggestions s
    where s.id = p_suggestion_id
    for update;

  if v_suggestion.status <> 'pending' then
    raise exception 'This suggestion was already decided'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  -- Accepted edits are spliced into one body at publication, so no two of them
  -- may claim the same text.
  if p_decision = 'accepted' and exists (
    select 1
      from public.review_suggestions s
      where s.case_id = p_case_id
        and s.status = 'accepted'
        and s.source_start < v_suggestion.source_end
        and v_suggestion.source_start < s.source_end
  ) then
    raise exception 'This edit overlaps an edit that was already accepted'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  update public.review_suggestions
    set status = p_decision,
        decided_by = (select auth.uid()),
        decided_at = now()
    where id = p_suggestion_id;

  perform public.close_review_panel(p_case_id);

  select rc.status into v_status from public.review_cases rc where rc.id = p_case_id;
  return v_status;
end;
$$;

revoke execute on function public.decide_review_suggestion(
  uuid, uuid, public.review_suggestion_status
) from public, anon;
grant execute on function public.decide_review_suggestion(
  uuid, uuid, public.review_suggestion_status
) to authenticated;

-- Same as 20260916210000_rename_todo_prerequisites_and_claims.sql except:
-- an approving majority waits while any verifier edit is still pending, and
-- accepted edits go live as a new revision, so the revision the panel judged
-- stays exactly as reviewed.
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

  -- An approval publishes, so it waits for the author's answer on every
  -- verifier edit. A rejection publishes nothing and closes as before.
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

    -- Approved strictly after the reviewed revision, so the version history
    -- reads reviewed -> accepted edits and diffing the two shows only the edits.
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

    -- revision_assets is the purge manifest. Copy the reviewed links, then add
    -- every managed asset the accepted text names by its storage key, so media
    -- a verifier referenced survives a purge of other revisions.
    -- Matching scans media_assets per publish; index storage keys if that grows.
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
