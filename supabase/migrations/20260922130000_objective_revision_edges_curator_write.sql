create policy "Curators can edit edges of their own draft revisions"
  on public.objective_revision_edges for all
  to authenticated
  using (
    public.has_role('curator')
    and exists (
      select 1 from public.objective_revisions r
      where r.id = revision_id
        and r.author_id = (select auth.uid())
        and r.status = 'draft'
    )
  )
  with check (
    public.has_role('curator')
    and exists (
      select 1 from public.objective_revisions r
      where r.id = revision_id
        and r.author_id = (select auth.uid())
        and r.status = 'draft'
    )
  );
