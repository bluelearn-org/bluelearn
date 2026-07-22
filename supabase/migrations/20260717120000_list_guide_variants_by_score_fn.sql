-- List published variants under a base, ranked by Wilson score lower bound, read only.
--
-- SECURITY INVOKER so the caller's RLS still scopes visibility, a draft
-- variant hidden by RLS stays hidden, and anyone not authorized will not be able to see it.

create or replace function public.list_guide_variants_by_score(
  p_guide_base_id uuid,
  p_z double precision default 1.96
)
returns table (
  id uuid,
  slug text,
  title text,
  summary text
)
language sql
security invoker
set search_path = public
as $$
  select
    g.id,
    g.slug,
    gr.title,
    gr.summary
  from public.guides g
  left join public.guide_revisions gr on gr.id = g.current_revision_id
  left join public.guide_vote_tallies t on t.guide_id = g.id
  where g.guide_base_id = p_guide_base_id
    and g.status = 'published'
  order by
    public.wilson_lower_bound(coalesce(t.upvotes, 0), coalesce(t.downvotes, 0), p_z) desc,
    (coalesce(t.upvotes, 0) + coalesce(t.downvotes, 0)) desc,
    g.id
$$;

grant execute on function public.list_guide_variants_by_score(uuid, double precision)
  to anon, authenticated, service_role;
