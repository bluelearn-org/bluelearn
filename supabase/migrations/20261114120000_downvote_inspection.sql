create function public.inspect_guide_downvotes(
  p_guide_id uuid default null,
  p_case_id uuid default null,
  p_page integer default 1,
  p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_guide_id uuid := p_guide_id;
  v_votes jsonb;
  v_total bigint;
begin
  if v_user_id is null
     or exists (
       select 1 from public.user_statuses
       where user_id = v_user_id and status = 'suspended'
     )
     or not exists (
       select 1 from public.user_roles where user_id = v_user_id
     ) then
    raise exception 'You cannot inspect these downvotes' using errcode = '42501';
  end if;

  if (p_guide_id is null) = (p_case_id is null)
     or p_page is null or p_page < 1
     or p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Invalid downvote inspection parameters' using errcode = '22023';
  end if;

  if p_case_id is not null then
    select gr.guide_id into v_guide_id
      from public.guide_review_cases gc
      join public.guide_revisions gr on gr.id = gc.guide_revision_id
      where gc.case_id = p_case_id;
  end if;

  if v_guide_id is null or not exists (
    select 1 from public.guides where id = v_guide_id
  ) then
    raise exception 'Guide not found' using errcode = 'P0002';
  end if;

  select count(*) into v_total from public.votes
    where guide_id = v_guide_id and direction = 'down';

  select coalesce(jsonb_agg(to_jsonb(v) order by v.updated_at desc, v.voter_id), '[]'::jsonb)
    into v_votes
    from (
      select votes.voter_id, profiles.username, votes.reason, votes.note, votes.updated_at
        from public.votes
        join public.profiles on profiles.id = votes.voter_id
        where votes.guide_id = v_guide_id and votes.direction = 'down'
        order by votes.updated_at desc, votes.voter_id
        limit p_limit offset (p_page::bigint - 1) * p_limit
    ) v;

  return jsonb_build_object('votes', v_votes, 'total', v_total);
end;
$$;

revoke all on function public.inspect_guide_downvotes(uuid, uuid, integer, integer) from public, anon;
grant execute on function public.inspect_guide_downvotes(uuid, uuid, integer, integer) to authenticated;
