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

// Compact reading-time for cards: "15m", "6h", "6h 30m".
export function formatDurationCompact(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

// extract headings from markdown content
export const extractHeadings = (markdown: string) => {
  const tree = unified().use(remarkParse).parse(markdown);

  const headings: Array<{ text: string; level: number }> = [];

  function walk(node: any) {
    if (node.type === "heading") {
      const text = node.children?.map((c: any) => c.value).join("") || "";

      headings.push({
        text,
        level: node.depth,
      });
    }

    if (node.children) {
      node.children.forEach(walk);
    }
  }

  walk(tree);

  return headings;
};
