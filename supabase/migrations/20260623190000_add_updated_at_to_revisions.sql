-- Published revisions are immutable, so the column only
-- ever changes while the revision is still a draft.

alter table public.guide_revisions
  add column updated_at timestamptz not null default now();

create trigger guide_revisions_touch_updated_at
  before update on public.guide_revisions
  for each row execute function public.touch_updated_at();

alter table public.learning_path_revisions
  add column updated_at timestamptz not null default now();

create trigger learning_path_revisions_touch_updated_at
  before update on public.learning_path_revisions
  for each row execute function public.touch_updated_at();
