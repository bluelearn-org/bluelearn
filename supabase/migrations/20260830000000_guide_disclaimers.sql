-- Guide disclaimers: content-category warnings (medical, financial, etc.)
-- Disclaimers live on guide_bases, not individual variants/revisions.

-- Lookup table of available disclaimer types.
create table public.disclaimers (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  label      text not null,
  description text
);

comment on table public.disclaimers is 'Content-category disclaimer types that can be attached to guides.';

-- Junction table linking guide bases to their disclaimers.
create table public.guide_disclaimers (
  guide_base_id uuid not null references public.guide_bases(id) on delete cascade,
  disclaimer_id uuid not null references public.disclaimers(id) on delete cascade,
  primary key (guide_base_id, disclaimer_id)
);

comment on table public.guide_disclaimers is 'Associates guide bases with content-category disclaimers.';

-- Index for looking up disclaimers by guide base.
create index idx_guide_disclaimers_base on public.guide_disclaimers(guide_base_id);

-- RLS: anyone can read disclaimers and guide_disclaimers; authenticated users can write guide_disclaimers.
alter table public.disclaimers enable row level security;
alter table public.guide_disclaimers enable row level security;

create policy "Disclaimers are publicly readable"
  on public.disclaimers for select
  using (true);

create policy "Guide disclaimers are publicly readable"
  on public.guide_disclaimers for select
  using (true);

create policy "Authenticated users can manage guide disclaimers"
  on public.guide_disclaimers for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Seed the five disclaimer types.
insert into public.disclaimers (slug, label, description) values
  ('medical',   'Medical',   'Content discusses medical topics'),
  ('financial', 'Financial', 'Content discusses financial topics'),
  ('legal',     'Legal',     'Content discusses legal topics'),
  ('mature',    'Mature',    'Content is age-restricted 18+'),
  ('profanity', 'Profanity', 'Content contains profanity');
