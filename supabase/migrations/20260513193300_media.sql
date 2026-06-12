create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  -- Storage bucket key, NOT the public URL
  storage_key text not null unique,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Many-to-many between revisions and assets, written when a revision is saved
create table public.revision_assets (
  revision_id uuid not null references public.guide_revisions (id) on delete cascade,
  asset_id uuid not null references public.media_assets (id) on delete cascade,
  primary key (revision_id, asset_id)
);

-- Reverse lookup: "which revisions still reference this asset?"
create index revision_assets_asset_id_idx on public.revision_assets (asset_id);

-- Storage bucket backing media_assets.storage_key
insert into storage.buckets (id, name, public)
values ('media', 'media', true);

-- Row-level security policies
alter table public.media_assets enable row level security;
alter table public.revision_assets enable row level security;

create policy "Media assets are viewable by everyone"
  on public.media_assets for select
  using (true);

create policy "Authenticated users can upload their own media"
  on public.media_assets for insert
  to authenticated
  with check (uploaded_by = (select auth.uid()));

create policy "Revision asset links are viewable by everyone"
  on public.revision_assets for select
  using (true);

create policy "Revision authors can link assets to their draft revisions"
  on public.revision_assets for insert
  to authenticated
  with check (
    exists (
      select 1 from public.guide_revisions r
      where r.id = revision_id
        and r.author_id = (select auth.uid())
        and r.status = 'draft'
    )
  );
