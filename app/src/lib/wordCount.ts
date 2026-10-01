// Strips markdown/HTML syntax down to actual writing rather than markup.
export function stripMarkdownForCounting(markdown: string): string {
  let text = markdown;

  // Images — content-free, never counted.
  text = text.replace(/<img\b[^>\n]*>/gi, "");
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, "");

  // Decode the literal entities this editor emits for spaces/tabs.
  text = text.replace(/&#x20;/g, " ").replace(/&#x9;/g, "\t");

  // Fenced code blocks — keep code content, strip syntax/language.
  text = text.replace(/^```[ \t]*[^\r\n]*\r?\n([\s\S]*?)^```[ \t]*$/gm, "$1");

  // Block math ($$...$$) — LaTeX, not prose. Strip entirely.
  text = text.replace(/\$\$[\s\S]*?\$\$/g, "");

  // Inline math ($...$) — same reasoning, single-line only.
  text = text.replace(/\$[^$\n]+\$/g, "");

  // Inline code (`...`) — keep content, strip backticks only.
  text = text.replace(/`([^`]*)`/g, "$1");

  // Callout directives (:::info, :::warning{...} ... :::, etc.)
  text = text.replace(/:::+[a-zA-Z0-9_-]*(\{[^}]*\})?/g, "");

  // Raw HTML tags (e.g. <u>, </u> from underline formatting).
  text = text.replace(/<\/?[a-z][^>\n]*>/gi, "");

  // Links: keep the visible text, drop the syntax and URL.
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");

  // Line-based block constructs: tables, blockquotes, headings, lists.
  text = text
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();

      // Table separator row (e.g. "| - | -- | ---- |") — pure syntax.
      if (/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/.test(trimmed)) {
        return "";
      }

      // Horizontal rule (---, ***, ___).
      if (/^([-*_])\s*(\1\s*){2,}$/.test(trimmed)) {
        return "";
      }

      let line_ = line;

      // Checkbox markers: "- [ ] Task" / "- [x] Task" -> "Task"
      line_ = line_.replace(/^\s*[-*+]\s+\[[ xX]\]\s+/, "");

      // Blockquote markers (handles nested ">>").
      line_ = line_.replace(/^(\s*>\s?)+/, "");

      // Heading markers.
      line_ = line_.replace(/^\s{0,3}#{1,6}\s+/, "");

      // Unordered list markers.
      line_ = line_.replace(/^\s*[-*+]\s+/, "");

      // Ordered list markers.
      line_ = line_.replace(/^\s*\d+[.)]\s+/, "");

      // Table rows: drop pipes and trim each cell so empty cells
      // contribute 0 characters instead of stray whitespace.
      if (line_.includes("|")) {
        const cells = line_.split("|");
        line_ = cells
          .map((cell) => cell.trim())
          .filter((cell) => cell.length > 0)
          .join(" ");
      }

      return line_;
    })
    .join("\n");

  text = text.replace(/~~/g, "");
  text = text.replace(/\*\*\*/g, "");
  text = text.replace(/\*\*/g, "");
  text = text.replace(/\*/g, "");
  text = text.replace(/___/g, "");
  text = text.replace(/__/g, "");
  text = text.replace(/_/g, "");

  return text;
}

export function getWordCount(markdown: string): number {
  const stripped = stripMarkdownForCounting(markdown)
    .replace(/\r\n/g, " ")
    .replace(/\n/g, " ")
    .replace(/\r/g, " ")
    .trim();
  return stripped ? stripped.split(/\s+/).length : 0;
}

export function getCharacterCount(markdown: string): number {
  return stripMarkdownForCounting(markdown).length;
}
