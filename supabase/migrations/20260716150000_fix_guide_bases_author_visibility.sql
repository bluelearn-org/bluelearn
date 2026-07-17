-- Previous id was bound to guides.id in the subquery, so authors never saw
-- their own draft base, which in turn broke the edge/todo delete policies.
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
