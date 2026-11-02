drop trigger review_cases_notify_guide_decision on public.review_cases;
drop function public.notify_guide_review_decision();

create function public.notify_review_decision()
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
create function public.notify_variant_publication()
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

-- Votes of either direction form separate unread groups for each guide.
drop trigger votes_notify_guide_upvote on public.votes;
drop function public.notify_guide_upvote();

create function public.notify_guide_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guide record;
  v_type text;
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

  v_type := case new.direction
    when 'up' then 'guide_upvotes'
    else 'guide_downvotes'
  end;

  perform public.notify(
    v_guide.author_id,
    v_type,
    new.voter_id,
    jsonb_build_object(
      'guide_id', new.guide_id,
      'title', v_guide.title,
      'base_slug', v_guide.base_slug,
      'variant_slug', v_guide.variant_slug
    ),
    new.guide_id::text
  );

  return null;
end;
$$;

revoke execute on function public.notify_guide_vote()
  from public, anon, authenticated;

create trigger votes_notify_guide_vote
  after insert or update of direction on public.votes
  for each row
  execute function public.notify_guide_vote();

create function public.notify_review_assignment()
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

-- Keep the claim after the inbox row is read or removed. A new assignee or
-- expiry permits one new reminder. A disabled preference consumes this event too.
create table public.review_deadline_notifications (
  seat_id uuid not null references public.panel_members (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null,
  primary key (seat_id, member_id, expires_at)
);

alter table public.review_deadline_notifications enable row level security;
revoke all on public.review_deadline_notifications from public, anon, authenticated;
grant all on public.review_deadline_notifications to service_role;

create function public.notify_review_deadlines()
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
