-- Commit the new enum value before policies and functions use it.
alter type public.app_role add value if not exists 'lead-verifier';
