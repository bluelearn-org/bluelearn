-- Suspending a prerequisite edge is a soft delete: the API flips is_suspended
-- via UPDATE rather than removing the row. Grant UPDATE to moderators/admins.
create policy "Moderators can suspend edges"
  on public.guide_edges for update
  to authenticated
  using (public.has_role('moderator') or public.has_role('admin'))
  with check (public.has_role('moderator') or public.has_role('admin'));
