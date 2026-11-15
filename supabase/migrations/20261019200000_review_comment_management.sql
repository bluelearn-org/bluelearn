-- Message ownership survives case closure and seat expiry.
-- Keep deleted rows so removing one message cannot remove another person's replies.
alter table public.review_threads
  add column edited_at timestamptz,
  add column deleted_at timestamptz;

alter table public.review_threads
  drop constraint review_threads_body_length,
  add constraint review_threads_body_length check (
    (deleted_at is null and char_length(btrim(body)) between 1 and 10000)
    or (deleted_at is not null and body = '')
  );

alter table public.review_thread_replies
  add column edited_at timestamptz,
  add column deleted_at timestamptz;

alter table public.review_thread_replies
  drop constraint review_thread_replies_body_length,
  add constraint review_thread_replies_body_length check (
    (deleted_at is null and char_length(btrim(body)) between 1 and 10000)
    or (deleted_at is not null and body = '')
  );

create or replace function public.edit_review_thread(
  p_case_id uuid,
  p_thread_id uuid,
  p_body text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_thread record;
begin
  select t.author_id, t.deleted_at
    into v_thread
    from public.review_threads t
    where t.id = p_thread_id and t.case_id = p_case_id
    for update;

  if not found then
    raise exception 'Thread not found' using errcode = 'no_data_found';
  end if;

  if v_uid is null or v_thread.author_id is distinct from v_uid then
    raise exception 'You can only change your own comments'
      using errcode = 'insufficient_privilege';
  end if;
  if not public.is_active_guide_author() then
    raise exception 'Suspended users cannot take part in reviews'
      using errcode = 'insufficient_privilege';
  end if;
  if v_thread.deleted_at is not null then
    raise exception 'Deleted comments cannot be edited'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  update public.review_threads
    set body = p_body, edited_at = now()
    where id = p_thread_id;
end;
$$;

revoke execute on function public.edit_review_thread(uuid, uuid, text)
  from public, anon;
grant execute on function public.edit_review_thread(uuid, uuid, text)
  to authenticated;

create or replace function public.delete_review_thread(
  p_case_id uuid,
  p_thread_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_thread record;
begin
  select t.author_id, t.deleted_at
    into v_thread
    from public.review_threads t
    where t.id = p_thread_id and t.case_id = p_case_id
    for update;

  if not found then
    raise exception 'Thread not found' using errcode = 'no_data_found';
  end if;

  if v_uid is null or v_thread.author_id is distinct from v_uid then
    raise exception 'You can only change your own comments'
      using errcode = 'insufficient_privilege';
  end if;
  if not public.is_active_guide_author() then
    raise exception 'Suspended users cannot take part in reviews'
      using errcode = 'insufficient_privilege';
  end if;

  update public.review_threads
    set body = '', deleted_at = now()
    where id = p_thread_id and deleted_at is null;
end;
$$;

revoke execute on function public.delete_review_thread(uuid, uuid)
  from public, anon;
grant execute on function public.delete_review_thread(uuid, uuid)
  to authenticated;

create or replace function public.edit_review_reply(
  p_case_id uuid,
  p_thread_id uuid,
  p_reply_id uuid,
  p_body text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_reply record;
begin
  select r.author_id, r.deleted_at
    into v_reply
    from public.review_thread_replies r
    join public.review_threads t on t.id = r.thread_id
    where r.id = p_reply_id
      and r.thread_id = p_thread_id
      and t.case_id = p_case_id
    for update of r;

  if not found then
    raise exception 'Reply not found' using errcode = 'no_data_found';
  end if;

  if v_uid is null or v_reply.author_id is distinct from v_uid then
    raise exception 'You can only change your own comments'
      using errcode = 'insufficient_privilege';
  end if;
  if not public.is_active_guide_author() then
    raise exception 'Suspended users cannot take part in reviews'
      using errcode = 'insufficient_privilege';
  end if;
  if v_reply.deleted_at is not null then
    raise exception 'Deleted comments cannot be edited'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  update public.review_thread_replies
    set body = p_body, edited_at = now()
    where id = p_reply_id;
end;
$$;

revoke execute on function public.edit_review_reply(uuid, uuid, uuid, text)
  from public, anon;
grant execute on function public.edit_review_reply(uuid, uuid, uuid, text)
  to authenticated;

create or replace function public.delete_review_reply(
  p_case_id uuid,
  p_thread_id uuid,
  p_reply_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_reply record;
begin
  select r.author_id, r.deleted_at
    into v_reply
    from public.review_thread_replies r
    join public.review_threads t on t.id = r.thread_id
    where r.id = p_reply_id
      and r.thread_id = p_thread_id
      and t.case_id = p_case_id
    for update of r;

  if not found then
    raise exception 'Reply not found' using errcode = 'no_data_found';
  end if;

  if v_uid is null or v_reply.author_id is distinct from v_uid then
    raise exception 'You can only change your own comments'
      using errcode = 'insufficient_privilege';
  end if;
  if not public.is_active_guide_author() then
    raise exception 'Suspended users cannot take part in reviews'
      using errcode = 'insufficient_privilege';
  end if;

  update public.review_thread_replies
    set body = '', deleted_at = now()
    where id = p_reply_id and deleted_at is null;
end;
$$;

revoke execute on function public.delete_review_reply(uuid, uuid, uuid)
  from public, anon;
grant execute on function public.delete_review_reply(uuid, uuid, uuid)
  to authenticated;
