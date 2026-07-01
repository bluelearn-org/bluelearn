create policy "Panelists can update their own decision"
  on public.review_decisions for update
  to authenticated
  using (
    exists (
      select 1 from public.panel_members pm
      where pm.id = panel_member_id
        and pm.member_id = (select auth.uid())
        and pm.status = 'assigned'
    )
  );
