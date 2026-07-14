grant all on all tables in schema public to anon, authenticated, service_role;

-- profiles' anon and authenticated do not get table-wide UPDATE. Instead
-- authenticated may update only the self-editable columns (username, bio,
-- display_name).
revoke update on public.profiles from anon, authenticated;
grant update (username, display_name, bio) on public.profiles to authenticated;

-- Restore the auto-grant for tables added by future migrations, matching the
-- old Supabase default.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
