// Turn a human title into a URL-safe slug. Lowercase is required by the
// *_slug_lowercase check constraints. Diacritics are folded so "Cafe" and
// "Café" collapse to the same handle.
export const slugify = (input: string): string =>
  input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
