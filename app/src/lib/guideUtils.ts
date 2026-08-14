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

const slugifyHeading = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

// extract headings from markdown content
export const extractHeadings = (markdown: string) => {
  const tree = unified().use(remarkParse).parse(markdown);

  const headings: Array<{ text: string; level: number; id: string }> = [];
  const seen = new Map<string, number>();

  function walk(node: any) {
    if (node.type === "heading") {
      const text = node.children?.map((c: any) => c.value ?? "").join("") || "";
      const base = slugifyHeading(text);
      const count = seen.get(base) ?? 0;
      const id = count === 0 ? base : `${base}-${count + 1}`;
      seen.set(base, count + 1);

      headings.push({
        text,
        level: node.depth,
        id,
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
