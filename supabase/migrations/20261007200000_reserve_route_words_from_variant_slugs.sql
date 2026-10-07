-- A variant is addressed as /guides/{base}/{variant}, and the same position
-- also serves /guides/{base}/walkthrough, /variants and /objectives (see
-- api/src/routes/guides.ts and app/src/routes/guides/$slug/). A variant whose
-- title slugified to one of those words could never be opened, so such a slug
-- is suffixed before it is stored, then numbered like any other sibling clash.

create or replace function public.avoid_reserved_guide_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug_base text := new.slug || '-guide';
  v_slug text := v_slug_base;
  v_suffix integer := 1;
begin
  while exists (
    select 1 from public.guides
    where guide_base_id = new.guide_base_id and slug = v_slug and id <> new.id
  ) loop
    v_suffix := v_suffix + 1;
    v_slug := v_slug_base || '-' || v_suffix;
  end loop;

  new.slug := v_slug;
  return new;
end;
$$;

revoke execute on function public.avoid_reserved_guide_slug() from public, anon, authenticated;

create trigger guides_avoid_reserved_slug
  before insert or update of slug on public.guides
  for each row
  when (new.slug in ('walkthrough', 'variants', 'objectives'))
  execute function public.avoid_reserved_guide_slug();

-- Rewrite any variant already stored under a route word.
update public.guides
  set slug = slug
  where slug in ('walkthrough', 'variants', 'objectives');
