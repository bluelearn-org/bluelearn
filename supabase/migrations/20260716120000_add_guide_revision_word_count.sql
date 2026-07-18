-- Stored word count of the revision body, kept by Postgres so list endpoints
-- can derive reading time without fetching full bodies.
alter table public.guide_revisions
  add column word_count integer not null
  generated always as (
    case
      when body is null or btrim(body) = '' then 0
      else array_length(regexp_split_to_array(btrim(body), '\s+'), 1)
    end
  ) stored;
