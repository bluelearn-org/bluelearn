-- A stale draft is an application conflict, not a retryable serialization failure.
do $$
declare
  v_definition text;
  v_old_code constant text := 'using errcode = ''serialization_failure'';';
  v_new_code constant text := 'using errcode = ''PT409'';';
begin
  select pg_get_functiondef(
    'public.publish_objective_revision(uuid)'::regprocedure
  ) into v_definition;

  if position(v_old_code in v_definition) = 0 then
    raise exception 'Expected stale revision error handling was not found';
  end if;

  execute replace(v_definition, v_old_code, v_new_code);
end;
$$;
