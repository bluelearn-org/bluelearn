create policy "Revision authors can unlink assets from their draft revisions"
  on public.revision_assets for delete
  to authenticated
  using (
    exists (
      select 1 from public.guide_revisions r
      where r.id = revision_id
        and r.author_id = (select auth.uid())
        and r.status = 'draft'
    )
  );

create policy "Authenticated users can upload to the media bucket"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'media' and owner = (select auth.uid()));
