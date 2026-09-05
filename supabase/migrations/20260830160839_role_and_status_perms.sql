-- Grants access for status access by users and needed access to admins for dashboard

create policy "Admins can view all roles"
on "public"."user_roles"
as permissive
for select
to public
using (public.has_role('admin'::public.app_role));

create policy "Admins can add roles"
on "public"."user_roles"
as permissive
for insert
to public
with check (public.has_role('admin'::public.app_role));

create policy "Admins can delete roles"
on "public"."user_roles"
as permissive
for delete
to public
using (public.has_role('admin'::public.app_role));

create policy "Admins can view statuses"
on "public"."user_statuses"
as permissive
for select
to authenticated
using (public.has_role('admin'::public.app_role));

create policy "Users can view their own status"
on "public"."user_statuses"
as permissive
for select
to public
using ((user_id = ( SELECT auth.uid() AS uid)));

create policy "Admins can update profiles"
on "public"."profiles"
as permissive
for update
to authenticated
using (public.has_role('admin'::public.app_role))
with check (public.has_role('admin'::public.app_role));

create policy "Admins can change statuses"
on "public"."user_statuses"
as permissive
for update
to authenticated
using (public.has_role('admin'::public.app_role))
with check (public.has_role('admin'::public.app_role));

grant update on public.profiles to authenticated;
