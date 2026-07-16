// Reading-time estimates. Guides store no word count, so a guide's duration is
// derived from its revision body at read time: words / WORDS_PER_MINUTE, rounded
// to whole minutes. A non-empty body never rounds below one minute.
export const WORDS_PER_MINUTE = 200;

export function countWords(body: string | null | undefined): number {
  if (!body) return 0;
  return body.trim().split(/\s+/).filter(Boolean).length;
}

export function readingMinutes(words: number): number {
  if (words <= 0) return 0;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
