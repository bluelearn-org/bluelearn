-- Cast or revise a panelist's decision in one transaction. Wrapping the three writes
-- here means a cast can never leave a half-written vote (reasons cleared but not
-- rewritten, or a seat never completed). The caller runs close_review_panel
-- afterwards to try to close the panel.
create or replace function public.cast_review_decision(
  p_case_id uuid,
  p_decision public.review_outcome,
  p_notes text default null,
  p_reasons public.decision_reason[] default '{}'
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_panel_id uuid;
  v_member_id uuid;
  v_decision_id uuid;
  v_created_at timestamptz;
  v_reasons public.decision_reason[];
begin
  select id into v_panel_id
    from public.review_panels
    where case_id = p_case_id and closed_at is null;
  if not found then
    raise exception 'No active review panel for this case'
      using errcode = 'invalid_parameter_value';
  end if;

  select id into v_member_id
    from public.panel_members
    where panel_id = v_panel_id
      and member_id = (select auth.uid())
      and status in ('assigned', 'completed');
  if not found then
    raise exception 'You are not an active panelist on this case'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.review_decisions (panel_member_id, decision, notes)
    values (v_member_id, p_decision, p_notes)
    on conflict (panel_member_id) do update
      set decision = excluded.decision, notes = excluded.notes
    returning id, created_at into v_decision_id, v_created_at;

  delete from public.review_decision_reasons where decision_id = v_decision_id;
  if p_decision = 'rejected' and p_reasons is not null then
    insert into public.review_decision_reasons (decision_id, reason)
    select v_decision_id, r from unnest(p_reasons) r;
  end if;

  update public.panel_members set status = 'completed' where id = v_member_id;

  v_reasons := case
    when p_decision = 'rejected' then coalesce(p_reasons, '{}')
    else '{}'
  end;

  return jsonb_build_object(
    'id', v_decision_id,
    'decision', p_decision,
    'notes', p_notes,
    'reasons', to_jsonb(v_reasons),
    'created_at', v_created_at
  );
end;
$$;

grant execute on function public.cast_review_decision(
  uuid, public.review_outcome, text, public.decision_reason[]
) to authenticated;
