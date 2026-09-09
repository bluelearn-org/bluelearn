create type "public"."user_status" as enum ('active', 'inactive', 'suspended');


  create table "public"."user_statuses" (
    "user_id" uuid not null,
    "status" public.user_status not null default 'active'::public.user_status,
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."user_statuses" enable row level security;

CREATE UNIQUE INDEX user_statuses_pkey ON public.user_statuses USING btree (user_id);

alter table "public"."user_statuses" add constraint "user_statuses_pkey" PRIMARY KEY using index "user_statuses_pkey";

grant delete on table "public"."user_statuses" to "anon";

grant insert on table "public"."user_statuses" to "anon";

grant references on table "public"."user_statuses" to "anon";

grant select on table "public"."user_statuses" to "anon";

grant trigger on table "public"."user_statuses" to "anon";

grant truncate on table "public"."user_statuses" to "anon";

grant update on table "public"."user_statuses" to "anon";

grant delete on table "public"."user_statuses" to "authenticated";

grant insert on table "public"."user_statuses" to "authenticated";

grant references on table "public"."user_statuses" to "authenticated";

grant select on table "public"."user_statuses" to "authenticated";

grant trigger on table "public"."user_statuses" to "authenticated";

grant truncate on table "public"."user_statuses" to "authenticated";

grant update on table "public"."user_statuses" to "authenticated";

grant delete on table "public"."user_statuses" to "service_role";

grant insert on table "public"."user_statuses" to "service_role";

grant references on table "public"."user_statuses" to "service_role";

grant select on table "public"."user_statuses" to "service_role";

grant trigger on table "public"."user_statuses" to "service_role";

grant truncate on table "public"."user_statuses" to "service_role";

grant update on table "public"."user_statuses" to "service_role";

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_username text;
begin
  requested_username := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
  if requested_username is null then
    requested_username := 'user-' || left(replace(new.id::text, '-', ''), 8);
  end if;
  begin
    insert into public.profiles (id, username)
    values (new.id, requested_username);
  exception when unique_violation then
    insert into public.profiles (id, username)
    values (new.id, requested_username || '-' || left(replace(new.id::text, '-', ''), 6));
  end;
  insert into public.user_statuses (user_id, status)
  values (new.id, 'active');
  return new;
end;
$$;
