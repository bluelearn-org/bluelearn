-- Rolling a learning path revision back clones an older revision's nodes into a
-- fresh draft on the same path. Unlike a guide revision (whose content lives
-- within one row), a path revision's content lives in its child node rows,
-- so the clone is an insert across two tables. Doing it in one RPC allows the
-- clone to occur within a single transaction, so a partial failure can never
-- leave an empty draft.
create or replace function public.rollback_learning_path_revision(
  p_revision_id uuid,
  p_source_revision_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_path_id uuid;
  v_title text;
  v_summary text;
  v_created_at timestamptz;
  v_new_revision_id uuid := gen_random_uuid();
begin
  -- The anchor revision names the path being rolled back. RLS hides revisions the
  -- caller may not read, so an unseen one reads as missing.
  select learning_path_id into v_path_id
    from public.learning_path_revisions
    where id = p_revision_id;

  if not found then
    raise exception 'Revision not found' using errcode = 'no_data_found';
  end if;

  -- The source must belong to that same path or there is nothing to restore here.
  select title, summary, created_at
    into v_title, v_summary, v_created_at
    from public.learning_path_revisions
    where id = p_source_revision_id
      and learning_path_id = v_path_id;

  if not found then
    raise exception 'Revision not found for this path'
      using errcode = 'no_data_found';
  end if;

  insert into public.learning_path_revisions
    (id, learning_path_id, title, summary, change_summary, author_id, status)
    values (
      v_new_revision_id,
      v_path_id,
      v_title,
      v_summary,
      'Rolled back to revision from ' || to_char(v_created_at, 'YYYY-MM-DD'),
      auth.uid(),
      'draft'
    );

  insert into public.learning_path_revision_nodes
    (revision_id, guide_base_id, guide_id, is_target, is_included, note)
  select v_new_revision_id, guide_base_id, guide_id, is_target, is_included, note
    from public.learning_path_revision_nodes
    where revision_id = p_source_revision_id;

  -- Return the draft revision id so the client routes straight to its editor.
  return v_new_revision_id;
end;
$$;

grant execute on function public.rollback_learning_path_revision(uuid, uuid)
  to authenticated;
