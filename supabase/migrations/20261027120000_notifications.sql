-- In-app notifications.
--
-- public.notify() is the only writer. It runs inside the transaction that
-- caused the event, so a notification commits or rolls back with its event.
-- To add a notification type, follow "To add a type" in
-- docs/database-schema.md.

create type public.notification_category as enum (
  'guide_statuses',
  'variant_statuses',
  'community_engagement',
  'review_workflows'
);

-- Preferences are kept per channel. Email adds a value here.
create type public.notification_channel as enum ('in_app');

create table public.notification_types (
  type text primary key,
  category public.notification_category not null,
  -- Applies until the user saves a preference for the type.
  default_enabled boolean not null
);

insert into public.notification_types (type, category, default_enabled) values
  ('guide_review_decision', 'guide_statuses', true),
  ('variant_created', 'guide_statuses', true),
  ('variant_review_decision', 'variant_statuses', false),
  ('variant_edited', 'variant_statuses', false),
  ('guide_upvotes', 'community_engagement', true),
  ('guide_downvotes', 'community_engagement', false),
  ('review_assignment', 'review_workflows', false),
  ('review_deadline', 'review_workflows', true);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type text not null references public.notification_types (type) on delete cascade,
  -- Null for system events, such as a panel outcome.
  actor_id uuid references public.profiles (id) on delete set null,
  -- Events with the same key share one unread row and raise its count.
  -- A null key gives every event its own row.
  group_key text,
  group_count integer not null default 1,
  -- Ids, slugs and titles that the app needs to show and link the row.
  -- Store only text that the recipient can already read.
  data jsonb not null default '{}'::jsonb,
  -- The time of the latest event in the row.
  occurred_at timestamptz not null default now(),
  read_at timestamptz,
  constraint notifications_group_count_positive check (group_count > 0)
);

-- One open row per group. Reading the row closes the group, so the next event
-- starts a new row.
create unique index notifications_open_group_idx
  on public.notifications (recipient_id, type, group_key)
  where read_at is null and group_key is not null;

create index notifications_recipient_occurred_idx
  on public.notifications (recipient_id, occurred_at desc);

create index notifications_recipient_unread_idx
  on public.notifications (recipient_id)
  where read_at is null;

-- A missing row means the type default applies.
create table public.notification_preferences (
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null references public.notification_types (type) on delete cascade,
  channel public.notification_channel not null default 'in_app',
  enabled boolean not null,
  primary key (user_id, type, channel)
);

create or replace function public.notify(
  p_recipient_id uuid,
  p_type text,
  p_actor_id uuid default null,
  p_data jsonb default '{}'::jsonb,
  p_group_key text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enabled boolean;
begin
  -- Nobody hears about their own actions.
  if p_recipient_id is null or p_recipient_id = p_actor_id then
    return;
  end if;

  select coalesce(p.enabled, t.default_enabled)
    into v_enabled
    from public.notification_types t
    left join public.notification_preferences p
      on p.type = t.type
     and p.user_id = p_recipient_id
     and p.channel = 'in_app'
   where t.type = p_type;

  if not found then
    raise exception 'Unknown notification type: %', p_type
      using errcode = '22023';
  end if;
  if not v_enabled then
    return;
  end if;

  insert into public.notifications
    (recipient_id, type, actor_id, group_key, data)
  values
    (p_recipient_id, p_type, p_actor_id, p_group_key, coalesce(p_data, '{}'::jsonb))
  on conflict (recipient_id, type, group_key)
    where read_at is null and group_key is not null
  do update set
    group_count = public.notifications.group_count + 1,
    actor_id = excluded.actor_id,
    data = excluded.data,
    occurred_at = now();
end;
$$;

-- Only database code and the service role may notify. A client cannot use
-- this function to send a notification to another user.
revoke execute on function public.notify(uuid, text, uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.notify(uuid, text, uuid, jsonb, text)
  to service_role;

-- guide_review_decision: the revision author hears the panel outcome.
-- close_review_panel sets the case status, so this trigger sees every outcome.
create or replace function public.notify_guide_review_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author_id uuid;
  v_title text;
begin
  select gr.author_id, gr.title
    into v_author_id, v_title
    from public.guide_review_cases grc
    join public.guide_revisions gr on gr.id = grc.guide_revision_id
   where grc.case_id = new.id;

  if not found then
    return null;
  end if;

  perform public.notify(
    v_author_id,
    'guide_review_decision',
    null,
    jsonb_build_object(
      'case_id', new.id,
      'outcome', new.status,
      'title', v_title
    )
  );
  return null;
end;
$$;

revoke execute on function public.notify_guide_review_decision()
  from public, anon, authenticated;

create trigger review_cases_notify_guide_decision
  after update of status on public.review_cases
  for each row
  when (
    new.status in ('approved', 'rejected')
    and old.status is distinct from new.status
  )
  execute function public.notify_guide_review_decision();

-- guide_upvotes: the guide author hears about new upvotes, one row per guide.
create or replace function public.notify_guide_upvote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author_id uuid;
  v_title text;
  v_base_slug text;
  v_variant_slug text;
begin
  -- Re-voting overwrites the row. Only a change to 'up' is a new upvote.
  if tg_op = 'UPDATE' and old.direction = 'up' then
    return null;
  end if;

  select g.author_id, gr.title, b.slug, g.slug
    into v_author_id, v_title, v_base_slug, v_variant_slug
    from public.guides g
    join public.guide_bases b on b.id = g.guide_base_id
    left join public.guide_revisions gr on gr.id = g.current_revision_id
   where g.id = new.guide_id;

  perform public.notify(
    v_author_id,
    'guide_upvotes',
    new.voter_id,
    jsonb_build_object(
      'guide_id', new.guide_id,
      'title', v_title,
      'base_slug', v_base_slug,
      'variant_slug', v_variant_slug
    ),
    new.guide_id::text
  );
  return null;
end;
$$;

revoke execute on function public.notify_guide_upvote()
  from public, anon, authenticated;

create trigger votes_notify_guide_upvote
  after insert or update of direction on public.votes
  for each row
  when (new.direction = 'up')
  execute function public.notify_guide_upvote();

-- Row-level security policies
alter table public.notification_types enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;

create policy "Anyone can view notification types"
  on public.notification_types for select
  using (true);

create policy "Users can view their own notifications"
  on public.notifications for select
  to authenticated
  using (recipient_id = (select auth.uid()));

create policy "Users can mark their own notifications read"
  on public.notifications for update
  to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

create policy "Users can view their own notification preferences"
  on public.notification_preferences for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can add their own notification preferences"
  on public.notification_preferences for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can change their own notification preferences"
  on public.notification_preferences for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- New tables get every privilege by default (20260713120000). Set the grants
-- again: the registry is read-only, and read_at is the only column a
-- recipient can change.
revoke all on public.notification_types from anon, authenticated;
grant select on public.notification_types to anon, authenticated;

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

revoke all on public.notification_preferences from anon, authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
