// Reading-time estimates. Word counts are stored on guide_revisions (a
// generated column over the body), so callers only turn a count into minutes:
// words / WORDS_PER_MINUTE, rounded to whole minutes. A non-empty body never
// rounds below one minute.
export const WORDS_PER_MINUTE = 200;

export function readingMinutes(words: number): number {
  if (words <= 0) return 0;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
