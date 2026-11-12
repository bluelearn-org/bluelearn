create or replace function public.notify_review_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revision record;
  v_type text;
begin
  select gr.author_id, gr.title, g.id as guide_id, b.canonical_guide_id
    into v_revision
    from public.guide_review_cases grc
    join public.guide_revisions gr on gr.id = grc.guide_revision_id
    join public.guides g on g.id = gr.guide_id
    join public.guide_bases b on b.id = g.guide_base_id
   where grc.case_id = new.id;

  if not found then
    return null;
  end if;

  -- The first canonical submission has no canonical pointer until approval publishes it.
  v_type := case
    when v_revision.canonical_guide_id is not null
      and v_revision.canonical_guide_id <> v_revision.guide_id
    then 'variant_review_decision'
    else 'guide_review_decision'
  end;

  perform public.notify(
    v_revision.author_id,
    v_type,
    null,
    jsonb_build_object(
      'case_id', new.id,
      'outcome', new.status,
      'title', v_revision.title
    )
  );

  return null;
end;
$$;

revoke execute on function public.notify_review_decision()
  from public, anon, authenticated;

create trigger review_cases_notify_decision
  after update of status on public.review_cases
  for each row
  when (
    new.status in ('approved', 'rejected')
    and old.status is distinct from new.status
  )
  execute function public.notify_review_decision();

-- Draft autosaves do not change the live revision. First publication and
-- later published edits notify through the same transaction as publication.
create or replace function public.notify_variant_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base record;
  v_revision record;
  v_recipient_id uuid;
  v_type text;
begin
  select b.slug, b.canonical_guide_id, g.author_id
    into v_base
    from public.guide_bases b
    left join public.guides g on g.id = b.canonical_guide_id
   where b.id = new.guide_base_id;

  if v_base.canonical_guide_id is null
    or v_base.canonical_guide_id = new.id then
    return null;
  end if;

  select gr.author_id, gr.title
    into v_revision
    from public.guide_revisions gr
   where gr.id = new.current_revision_id;

  if old.current_revision_id is null then
    v_type := 'variant_created';
    v_recipient_id := v_base.author_id;
  else
    v_type := 'variant_edited';
    v_recipient_id := new.author_id;
  end if;

  perform public.notify(
    v_recipient_id,
    v_type,
    v_revision.author_id,
    jsonb_build_object(
      'guide_id', new.id,
      'title', v_revision.title,
      'base_slug', v_base.slug,
      'variant_slug', new.slug
    )
  );

  return null;
end;
$$;

revoke execute on function public.notify_variant_publication()
  from public, anon, authenticated;

create trigger guides_notify_variant_publication
  after update of current_revision_id on public.guides
  for each row
  when (
    new.status = 'published'
    and new.current_revision_id is not null
    and old.current_revision_id is distinct from new.current_revision_id
  )
  execute function public.notify_variant_publication();

-- One row per guide author, guide, and vote direction. The vote tiers count
-- from started_at.
create table public.notification_vote_tallies (
  author_id uuid not null references public.profiles (id) on delete cascade,
  guide_id uuid not null references public.guides (id) on delete cascade,
  type text not null references public.notification_types (type) on delete cascade,
  -- The first counted vote.
  started_at timestamptz not null default now(),
  -- Distinct voters so far.
  total integer not null default 0,
  -- The total at the latest notification. A disabled preference still moves it.
  notified_total integer not null default 0,
  -- Downvote reasons and notes since the latest notification, newest first.
  feedback jsonb not null default '[]'::jsonb,
  primary key (author_id, guide_id, type)
);

-- Each tally counts a voter once. The voters stay in this table, which clients
-- cannot read, because a downvote must not name its voter.
create table public.notification_voters (
  author_id uuid not null,
  guide_id uuid not null,
  type text not null,
  voter_id uuid not null references public.profiles (id) on delete cascade,
  primary key (author_id, guide_id, type, voter_id),
  foreign key (author_id, guide_id, type)
    references public.notification_vote_tallies on delete cascade
);

alter table public.notification_vote_tallies enable row level security;
revoke all on public.notification_vote_tallies from public, anon, authenticated;
grant all on public.notification_vote_tallies to service_role;

alter table public.notification_voters enable row level security;
revoke all on public.notification_voters from public, anon, authenticated;
grant all on public.notification_voters to service_role;

-- Votes notify the guide author in tiers, timed from the first counted vote in
-- each direction. In the live tier every vote joins one row, and an upvote
-- names its voter. After it, votes count silently, and a new row shows the
-- total once enough new voters arrive. A downvote row carries the reason and
-- note of each downvote since the previous row, newest first, but no actor, so
-- the author learns why the guide was downvoted but not who downvoted it. A
-- disabled preference consumes the row that would have been sent.
create or replace function public.notify_guide_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guide record;
  v_type text;
  v_tally record;
  v_total integer;
  v_milestone integer;
  v_feedback jsonb;
  v_data jsonb;
begin
  if tg_op = 'UPDATE' and old.direction = new.direction then
    return null;
  end if;

  select g.author_id, gr.title, b.slug as base_slug, g.slug as variant_slug
    into v_guide
    from public.guides g
    join public.guide_bases b on b.id = g.guide_base_id
    left join public.guide_revisions gr on gr.id = g.current_revision_id
   where g.id = new.guide_id;

  -- A vote counts only toward another user's guide.
  if v_guide.author_id is null or new.voter_id = v_guide.author_id then
    return null;
  end if;

  v_type := case new.direction
    when 'up' then 'guide_upvotes'
    else 'guide_downvotes'
  end;

  insert into public.notification_vote_tallies (author_id, guide_id, type)
  values (v_guide.author_id, new.guide_id, v_type)
  on conflict do nothing;

  -- Concurrent votes on the guide wait for this lock, so none is lost.
  select *
    into v_tally
    from public.notification_vote_tallies t
   where t.author_id = v_guide.author_id
     and t.guide_id = new.guide_id
     and t.type = v_type
     for update;

  insert into public.notification_voters (author_id, guide_id, type, voter_id)
  values (v_guide.author_id, new.guide_id, v_type, new.voter_id)
  on conflict do nothing;

  if not found then
    return null;
  end if;

  v_total := v_tally.total + 1;
  v_feedback := v_tally.feedback;
  v_data := jsonb_build_object(
    'guide_id', new.guide_id,
    'title', v_guide.title,
    'base_slug', v_guide.base_slug,
    'variant_slug', v_guide.variant_slug
  );

  if new.direction = 'down' then
    v_feedback := jsonb_build_array(
      jsonb_build_object('reason', new.reason, 'note', new.note)
    ) || v_feedback;
  end if;

  -- Tune the tiers here.
  v_milestone := case
    when now() < v_tally.started_at + interval '7 days'
      then v_tally.notified_total + 5
    else v_tally.notified_total * 2
  end;

  if now() < v_tally.started_at + interval '24 hours' then
    if new.direction = 'down' then
      v_data := v_data || jsonb_build_object(
        'feedback',
        v_feedback || coalesce(
          (select n.data -> 'feedback'
             from public.notifications n
            where n.recipient_id = v_guide.author_id
              and n.type = v_type
              and n.group_key = new.guide_id::text),
          '[]'::jsonb
        )
      );
    end if;

    perform public.notify(
      v_guide.author_id,
      v_type,
      case new.direction when 'up' then new.voter_id end,
      v_data,
      new.guide_id::text
    );
  elsif v_total >= v_milestone then
    if new.direction = 'down' then
      v_data := v_data || jsonb_build_object('feedback', v_feedback);
    end if;

    perform public.notify(
      v_guide.author_id,
      v_type,
      null,
      v_data || jsonb_build_object('total', v_total)
    );
  else
    update public.notification_vote_tallies
       set total = v_total,
           feedback = v_feedback
     where author_id = v_guide.author_id
       and guide_id = new.guide_id
       and type = v_type;

    return null;
  end if;

  update public.notification_vote_tallies
     set total = v_total,
         notified_total = v_total,
         feedback = '[]'::jsonb
   where author_id = v_guide.author_id
     and guide_id = new.guide_id
     and type = v_type;

  return null;
end;
$$;

revoke execute on function public.notify_guide_vote()
  from public, anon, authenticated;

create trigger votes_notify_guide_vote
  after insert or update of direction on public.votes
  for each row
  execute function public.notify_guide_vote();

create or replace function public.notify_review_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case record;
begin
  if tg_op = 'UPDATE'
    and old.member_id = new.member_id
    and old.status = 'assigned' then
    return null;
  end if;

  select rc.id, gr.title
    into v_case
    from public.review_panels rp
    join public.review_cases rc on rc.id = rp.case_id
    left join public.guide_review_cases grc on grc.case_id = rc.id
    left join public.guide_revisions gr on gr.id = grc.guide_revision_id
   where rp.id = new.panel_id
     and rp.closed_at is null
     and rc.status in ('pending', 'in_review');

  if not found then
    return null;
  end if;

  perform public.notify(
    new.member_id,
    'review_assignment',
    null,
    jsonb_build_object(
      'case_id', v_case.id,
      'seat_id', new.id,
      'title', v_case.title,
      'expires_at', new.expires_at
    )
  );

  return null;
end;
$$;

revoke execute on function public.notify_review_assignment()
  from public, anon, authenticated;

create trigger panel_members_notify_assignment
  after insert or update of member_id, status on public.panel_members
  for each row
  when (new.status = 'assigned')
  execute function public.notify_review_assignment();

-- Keep the claim after the inbox row is read. A new assignee or expiry permits
-- one new reminder. A disabled preference consumes this event too.
create table public.review_deadline_notifications (
  seat_id uuid not null references public.panel_members (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null,
  primary key (seat_id, member_id, expires_at)
);

alter table public.review_deadline_notifications enable row level security;
revoke all on public.review_deadline_notifications from public, anon, authenticated;
grant all on public.review_deadline_notifications to service_role;

create or replace function public.notify_review_deadlines()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seat record;
begin
  for v_seat in
    with claimed as (
      insert into public.review_deadline_notifications (seat_id, member_id, expires_at)
      select pm.id, pm.member_id, pm.expires_at
        from public.panel_members pm
        join public.review_panels rp on rp.id = pm.panel_id
        join public.review_cases rc on rc.id = rp.case_id
       where pm.status = 'assigned'
         and pm.member_id is not null
         and rp.closed_at is null
         and rc.status = 'in_review'
         and pm.expires_at > now()
         and pm.expires_at <= now() + interval '48 hours'
      on conflict (seat_id, member_id, expires_at) do nothing
      returning seat_id, member_id, expires_at
    )
    select pm.id, c.member_id, c.expires_at, rc.id as case_id, gr.title
      from claimed c
      join public.panel_members pm on pm.id = c.seat_id
      join public.review_panels rp on rp.id = pm.panel_id
      join public.review_cases rc on rc.id = rp.case_id
      left join public.guide_review_cases grc on grc.case_id = rc.id
      left join public.guide_revisions gr on gr.id = grc.guide_revision_id
  loop
    perform public.notify(
      v_seat.member_id,
      'review_deadline',
      null,
      jsonb_build_object(
        'case_id', v_seat.case_id,
        'seat_id', v_seat.id,
        'title', v_seat.title,
        'expires_at', v_seat.expires_at
      )
    );
  end loop;
end;
$$;

revoke execute on function public.notify_review_deadlines()
  from public, anon, authenticated;
grant execute on function public.notify_review_deadlines() to service_role;
