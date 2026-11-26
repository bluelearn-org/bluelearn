-- Delete revisions, not their parent guides or objectives: other revisions and
-- references to those parents must survive discarding an unfinished edit.
create policy "Authors can delete their own draft guide revisions"
  on public.guide_revisions for delete to authenticated
  using (
    author_id = (select auth.uid()) and status = 'draft'
    and (select public.is_active_guide_author())
  );

create policy "Authors can delete their own draft objective revisions"
  on public.objective_revisions for delete to authenticated
  using (author_id = (select auth.uid()) and status = 'draft');

create function public.delete_own_drafts(
  p_guide_revision_ids uuid[],
  p_objective_revision_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if p_guide_revision_ids is null or p_objective_revision_ids is null
    or cardinality(p_guide_revision_ids) + cardinality(p_objective_revision_ids) not between 1 and 100 then
    raise check_violation using message = 'Select between 1 and 100 drafts';
  end if;

  -- The predicates are checked by DELETE itself, including after waiting for
  -- concurrent updates. A stale selection rolls back the entire batch.
  delete from public.guide_revisions
  where id = any(p_guide_revision_ids)
    and author_id = (select auth.uid()) and status = 'draft';
  get diagnostics deleted_count = row_count;
  if deleted_count <> cardinality(p_guide_revision_ids) then
    raise no_data_found using message = 'One or more drafts are no longer available';
  end if;

  delete from public.objective_revisions
  where id = any(p_objective_revision_ids)
    and author_id = (select auth.uid()) and status = 'draft';
  get diagnostics deleted_count = row_count;
  if deleted_count <> cardinality(p_objective_revision_ids) then
    raise no_data_found using message = 'One or more drafts are no longer available';
  end if;
end;
$$;

revoke execute on function public.delete_own_drafts(uuid[], uuid[]) from public, anon;
grant execute on function public.delete_own_drafts(uuid[], uuid[]) to authenticated;
