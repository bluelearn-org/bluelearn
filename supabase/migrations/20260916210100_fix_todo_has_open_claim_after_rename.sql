create or replace function public.todo_has_open_claim(p_todo_ids uuid[], p_exclude_base_id uuid default null)
  returns boolean
  language sql
  security definer
  set search_path = ''
  as $$
  select exists (
      select 1
      from public.request_claims tc
      join public.guides g on g.guide_base_id = tc.guide_base_id
      join public.guide_revisions gr on gr.guide_id = g.id
      join public.guide_review_cases grc on grc.guide_revision_id = gr.id
      join public.review_cases rc on rc.id = grc.case_id
      where tc.todo_id = any (p_todo_ids)
        and (p_exclude_base_id is null or g.guide_base_id <> p_exclude_base_id)
        and rc.status::text not in ('approved', 'rejected', 'canceled', 'cancelled')
  );
$$;
