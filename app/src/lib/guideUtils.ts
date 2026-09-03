import { unified } from "unified";
import remarkParse from "remark-parse";

// format duration mins -> hrs & mins
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins} min`;
  }

  if (mins === 0) {
    return `${hours} hr${hours > 1 ? "s" : ""}`;
  }

  return `${hours} hr${hours > 1 ? "s" : ""} ${mins} min`;
}

// Rough read time for the submit preview (~200 wpm)
export function estimateReadMinutes(markdown: string): number {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function formatDate(date: Date): string {
  const day = date.getDate();
  const tens = day % 100;
  const suffix =
    tens >= 11 && tens <= 13
      ? "th"
      : (["th", "st", "nd", "rd"][day % 10] ?? "th");
  const month = date.toLocaleString("en-GB", { month: "long" });
  return `${day}${suffix} ${month} ${date.getFullYear()}`;
}

// The live revision a draft is seeded from, for detecting no-op submissions.
export type RevisionDraftSnapshot = {
  title: string | null;
  summary: string | null;
  body: string | null;
  change_summary: string | null;
  subjectIds: Array<string>;
};

// The fields a revision draft carries at submit time. Mirrors the shape the
// editor builds when persisting a draft.
export type RevisionDraft = {
  title: string | null;
  summary: string | null;
  body: string | null;
  change_summary: string | null;
  tags: Array<string>;
  newSubjects: Array<{ name: string; summary: string | null }>;
};

// True when the draft is byte-for-byte identical to the live revision it was
// seeded from (change summary included), so a submit with no real edits can be
// blocked. Tag order is ignored; new subjects count as a change.
export function isRevisionDraftUnchanged(
  original: RevisionDraftSnapshot,
  draft: RevisionDraft
): boolean {
  const sameField = (a: string | null, b: string | null) =>
    (a ?? "") === (b ?? "");

  const originalTags = [...original.subjectIds].sort();
  const draftTags = [...draft.tags].sort();
  const sameTags =
    originalTags.length === draftTags.length &&
    originalTags.every((id, i) => id === draftTags[i]);

  return (
    sameField(original.title, draft.title) &&
    sameField(original.summary, draft.summary) &&
    sameField(original.body, draft.body) &&
    sameTags &&
    draft.newSubjects.length === 0
  );
}

const slugifyHeading = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const getMarkdownText = (node: any): string => {
  if (typeof node.value === "string") {
    // strip HTML tags such as <u>, </u>, <strong>, etc.
    return node.type === "html"
      ? node.value.replace(/<[^>]*>/g, "")
      : node.value;
  }
  return node.children?.map(getMarkdownText).join("") ?? "";
};

// extract headings from markdown content
export const extractHeadings = (markdown: string) => {
  const tree = unified().use(remarkParse).parse(markdown);

  const headings: Array<{
    text: string;
    level: number;
    id: string;
  }> = [];

  const headingIds = new Map<string, number>();

  function walk(node: any) {
    if (node.type === "heading") {
      const text = getMarkdownText(node).trim();

      headings.push({
        text,
        level: node.depth,
        id: getHeadingId(text, headingIds),
      });
    }

    if (node.children) {
      node.children.forEach(walk);
    }
  }

  walk(tree);

  return headings;
};

export const getHeadingId = (text: string, seen: Map<string, number>) => {
  const base = slugifyHeading(text);
  const count = seen.get(base) ?? 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
};
