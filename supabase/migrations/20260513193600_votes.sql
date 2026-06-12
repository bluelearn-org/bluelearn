create type public.vote_direction as enum ('up', 'down');

-- Required on downvotes only
create type public.downvote_reason as enum (
  'unclear',
  'factually_wrong',
  'missing_step',
  'outdated',
  'broken_link',
  'prereq_gap',
  'wrong_level',
  'scope_creep'
);

create table public.votes (
  voter_id uuid not null references public.profiles (id) on delete cascade,
  guide_id uuid not null references public.guides (id) on delete cascade,
  direction public.vote_direction not null,
  reason public.downvote_reason,
  note text,
  created_at timestamptz not null default now(),
  -- Re-voting overwrites the row (PUT semantics), so track when it last changed.
  updated_at timestamptz not null default now(),
  primary key (voter_id, guide_id),
  -- Reason present iff direction = 'down'
  constraint votes_reason_matches_direction
    check ((direction = 'down') = (reason is not null))
);

-- Sibling ordering scans votes per guide.
create index votes_guide_id_idx on public.votes (guide_id);

create trigger votes_touch_updated_at
  before update on public.votes
  for each row execute function public.touch_updated_at();

-- Row-level security policies
alter table public.votes enable row level security;

create policy "Users can view their own votes"
  on public.votes for select
  using (voter_id = (select auth.uid()));

create policy "Moderators can view all votes"
  on public.votes for select
  to authenticated
  using (public.has_role('moderator') or public.has_role('admin'));

create policy "Users can vote on published guides"
  on public.votes for insert
  to authenticated
  with check (
    voter_id = (select auth.uid())
    and exists (
      select 1 from public.guides g
      where g.id = guide_id and g.status = 'published'
    )
  );

create policy "Users can change their own votes"
  on public.votes for update
  to authenticated
  using (voter_id = (select auth.uid()))
  with check (voter_id = (select auth.uid()));

create policy "Users can retract their own votes"
  on public.votes for delete
  to authenticated
  using (voter_id = (select auth.uid()));

-- Public tally: exposes counts only and not reason/note/voter
create view public.guide_vote_tallies as
select
  guide_id,
  count(*) filter (where direction = 'up') as upvotes,
  count(*) filter (where direction = 'down') as downvotes
from public.votes
group by guide_id;
