-- Create-topic bundle: a draft guide_base + its first guide (the original
-- write-up) + that guide's first draft revision in one transaction.

create or replace function public.create_topic(
  p_title text,
  p_slug text,
  p_knowledge_type public.knowledge_type,
  p_summary text default null,
  p_body text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_base_id uuid := gen_random_uuid();
  v_guide_id uuid := gen_random_uuid();
  v_revision_id uuid := gen_random_uuid();
begin
  insert into public.guide_bases (id, slug, title, knowledge_type, status)
    values (v_base_id, p_slug, p_title, p_knowledge_type, 'draft');

  -- We leave canonical_guide_id as NULL for now. The circular reference
  -- between base and guide will only matter once the topic is published.
  insert into public.guides (id, guide_base_id, author_id, status)
    values (v_guide_id, v_base_id, auth.uid(), 'draft');

  insert into public.guide_revisions
    (id, guide_id, revision_number, title, summary, body, author_id, status)
    values (v_revision_id, v_guide_id, 1, p_title, p_summary, p_body, auth.uid(), 'draft');

  -- Return the draft revision id, as the client routes
  -- straight to the editor for it.
  return v_revision_id;
end;
$$;

grant execute on function public.create_topic(
  text, text, public.knowledge_type, text, text
) to authenticated;
