-- Activates when another base has a todo still pending/being reviewed.
-- Security definer lets gate see rival drafts the caller can't.
create or replace function public.todo_has_open_claim(p_todo_ids uuid[], p_exclude_base_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.todo_claims tc
      join public.guides g on g.guide_base_id = tc.guide_base_id
      join public.guide_revisions gr on gr.guide_id = g.id
      join public.guide_review_cases grc on grc.guide_revision_id = gr.id
      join public.review_cases rc on rc.id = grc.case_id
     where tc.todo_id = any (p_todo_ids)
       and tc.guide_base_id <> p_exclude_base_id
       and rc.status in ('pending', 'in_review')
  );
$$;

grant execute on function public.todo_has_open_claim(uuid[], uuid) to authenticated;
