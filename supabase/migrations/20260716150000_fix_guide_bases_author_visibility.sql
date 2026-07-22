-- Previous id was bound to guides.id in the policy within
-- 20260513193200_guides.sql, so authors couldn't see
-- their own draft bases before.
drop policy "Published topics are viewable by everyone" on public.guide_bases;
create policy "Published topics are viewable by everyone"
  on public.guide_bases for select
  using (
    status <> 'draft'
    or exists (
      select 1 from public.guides g
      where g.guide_base_id = guide_bases.id
        and g.author_id = (select auth.uid())
    )
  );

drop policy "Guide authors can update their draft topics" on public.guide_bases;
create policy "Guide authors can update their draft topics"
  on public.guide_bases for update
  to authenticated
  using (
    status = 'draft'
    and exists (
      select 1 from public.guides g
      where g.guide_base_id = guide_bases.id
        and g.author_id = (select auth.uid())
    )
  )
  with check (status = 'draft');
