-- Helper: lower bound of the Wilson score interval for up/down votes and a
-- given confidence level (default 0.95 i.e. z = 1.96). Returns 0 when there
-- are no votes, so unrated guides rank below any guide with positive evidence.
-- https://www.evanmiller.org/how-not-to-sort-by-average-rating.html

create or replace function public.wilson_lower_bound(
  upvotes bigint,
  downvotes bigint,
  confidence float8 default 0.95
)
returns float8
language sql immutable
as $$
  select case
    when upvotes + downvotes = 0 then 0.0
    else (
      (proportion + z_sq / (2.0 * n) - z * sqrt((proportion * (1.0 - proportion) + z_sq / (4.0 * n)) / n))
      / (1.0 + z_sq / n)
    )
  end
  from (
    select
      upvotes::float8 / (upvotes + downvotes) as proportion,
      (upvotes + downvotes)::float8 as n,
      case confidence
        when 0.90 then 1.645::float8
        when 0.95 then 1.960::float8
        when 0.99 then 2.576::float8
        else 1.960::float8
      end as z,
      case confidence
        when 0.90 then 2.706::float8
        when 0.95 then 3.842::float8
        when 0.99 then 6.635::float8
        else 3.842::float8
      end as z_sq
  ) params
$$;

grant execute on function public.wilson_lower_bound(bigint, bigint, float8)
  to authenticated, service_role;


-- Promote a sibling variant to canonical based on Wilson score. The challenger
-- must beat the incumbent by p_margin (default 0.05) and have at least
-- p_min_votes (default 5) to flip. SECURITY DEFINER so the update on
-- guide_bases bypasses RLS (no UPDATE policy covers published bases).
--
-- Returns the canonical_guide_id after evaluation (same as before or the
-- promoted challenger), or null if the base was not found.

create or replace function public.promote_canonical_guide(
  p_guide_base_id uuid,
  p_z double precision default 1.96,
  p_margin double precision default 0.05,
  p_min_votes integer default 5
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_id uuid;
  v_top_id uuid;
  v_top_score float8;
  v_current_score float8;
begin
  select gb.canonical_guide_id
    into v_current_id
    from public.guide_bases gb
    where gb.id = p_guide_base_id;

  if not found then
    return null;
  end if;

  -- Top-scoring published sibling variant that clears the vote floor.
  select g.id,
         public.wilson_lower_bound(coalesce(t.upvotes, 0), coalesce(t.downvotes, 0)) as score
  into v_top_id, v_top_score
  from public.guides g
  left join public.guide_vote_tallies t on t.guide_id = g.id
  where g.guide_base_id = p_guide_base_id
    and g.status = 'published'
    and coalesce(t.upvotes, 0) + coalesce(t.downvotes, 0) >= p_min_votes
  order by score desc,
    (coalesce(t.upvotes, 0) + coalesce(t.downvotes, 0)) desc,
    g.id
  limit 1;

  if v_top_id is null then
    return v_current_id;
  end if;

  if v_top_id = v_current_id then
    return v_current_id;
  end if;

  if v_current_id is null then
    update public.guide_bases
      set canonical_guide_id = v_top_id
      where id = p_guide_base_id;
    return v_top_id;
  end if;

  select public.wilson_lower_bound(coalesce(t.upvotes, 0), coalesce(t.downvotes, 0))
    into v_current_score
    from public.guides g
    left join public.guide_vote_tallies t on t.guide_id = g.id
    where g.id = v_current_id;

  if v_current_score is null then
    v_current_score := 0.0;
  end if;

  if v_top_score - v_current_score >= p_margin then
    update public.guide_bases
      set canonical_guide_id = v_top_id
      where id = p_guide_base_id;
    return v_top_id;
  end if;

  return v_current_id;
end;
$$;

grant execute on function public.promote_canonical_guide(
  uuid, double precision, double precision, integer
) to authenticated, service_role;
