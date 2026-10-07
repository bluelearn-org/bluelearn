import type { Walkthrough } from "@bluelearn/schemas";

export type SubjectSearch = { subject?: string };

// Only the subject slug travels in the URL, so a scoped walkthrough can be
// shared and the back button restores it. Anything else is dropped.
export function parseSubjectSearch(
  raw: Record<string, unknown>
): SubjectSearch {
  const subject = raw.subject;
  if (typeof subject !== "string") return {};

  const trimmed = subject.trim();
  return trimmed ? { subject: trimmed } : {};
}

export type ScopeOption = { slug: string | null; name: string };

export const ALL_PREREQUISITES: ScopeOption = {
  slug: null,
  name: "All prerequisites",
};

// The scopes a walkthrough can be read in: every prerequisite, or one of the
// target guide's own subjects, each of which may declare a floor. Other nodes'
// tags are not offered, because a floor belongs to the subject the reader is
// studying, and that is the target's.
export function scopeOptions(
  nodes: Walkthrough["nodes"],
  targetSlug: string
): Array<ScopeOption> {
  const target = nodes.find((node) => node.slug === targetSlug);
  const tags = [...(target?.tags ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return [
    ALL_PREREQUISITES,
    ...tags.map((tag) => ({ slug: tag.slug, name: tag.name })),
  ];
}

// How many of the walkthrough's guides sit in the scope's floor.
export function floorCount(nodes: Walkthrough["nodes"]) {
  return nodes.filter((node) => node.is_floor).length;
}
