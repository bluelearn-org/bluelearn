-- A downvote may name the section of the guide it is about. The value is the
-- heading anchor the reader's table of contents links to (getHeadingId in the
-- app), so flags can later be grouped by section; null means the whole guide.
alter table public.votes
  add column section_ref text,
  add constraint votes_section_ref_downvotes_only
    check (section_ref is null or direction = 'down'),
  add constraint votes_section_ref_length
    check (section_ref is null or length(section_ref) between 1 and 200);
