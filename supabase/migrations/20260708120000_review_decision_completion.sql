-- Casting a decision completes the seat, and re-votes may revise both the
-- decision and its rubric reasons. These policies let a panelist do that to
-- their own seat / decision only.

create policy "Panelists can complete their own seat"
  on public.panel_members for update
  to authenticated
  using (member_id = (select auth.uid()))
  with check (member_id = (select auth.uid()));

-- Re-votes upsert the decision, so the insert check must also accept a seat
-- that is already completed (not just a fresh assigned one).
drop policy "Panelists can cast their own decision" on public.review_decisions;
create policy "Panelists can cast their own decision"
  on public.review_decisions for insert
  to authenticated
  with check (
    exists (
      select 1 from public.panel_members pm
      where pm.id = panel_member_id
        and pm.member_id = (select auth.uid())
        and pm.status in ('assigned', 'completed')
    )
  );

-- A re-vote replaces its rubric reasons, so a panelist may delete reasons on
-- their own decision before writing the new set.
create policy "Panelists can clear reasons on their own decision"
  on public.review_decision_reasons for delete
  to authenticated
  using (
    exists (
      select 1
      from public.review_decisions d
      join public.panel_members pm on pm.id = d.panel_member_id
      where d.id = decision_id and pm.member_id = (select auth.uid())
    )
  );
