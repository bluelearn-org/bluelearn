create policy "Admins can insert statuses"
on "public"."user_statuses"
as permissive
for insert
to authenticated
with check (public.has_role('admin'::public.app_role));
