-- Add a soft-disable flag and audit timestamps to guide_edges.
alter table public.guide_edges
  add column is_suspended boolean not null default false,
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now();

create trigger guide_edges_touch_updated_at
  before update on public.guide_edges
  for each row execute function public.touch_updated_at();
