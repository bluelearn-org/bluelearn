import { REVIEW_QUOTE_MAX_LENGTH } from "@bluelearn/schemas";

// Store UTF-16 offsets in top-level block text; DOM Ranges become invalid when guide nodes change.
// Detach mismatched quotes rather than attaching feedback to different text.

// AnnotatedBlock puts these on the content element of each block.
export const BLOCK_CONTENT_ATTR = "data-review-block-content";
export const BLOCK_SOURCE_START_ATTR = "data-source-start";
export const BLOCK_SOURCE_END_ATTR = "data-source-end";
// Comment cards, badges, and selection controls of the review page. A
// selection that starts or ends in this UI makes no passage.
export const ANNOTATION_UI_ATTR = "data-review-ui";
// Controls that a guide component draws inside a block, such as the CodeBlock
// language label and Copy button. Guide text skips these controls, so a label
// change never moves an anchor.
export const GUIDE_UI_ATTR = "data-guide-ui";

export type PassageAnchor = {
  kind: "passage" | "block";
  start_block: number;
  start_offset: number;
  end_block: number;
  end_offset: number;
  quote: string;
  source_start: number | null;
  source_end: number | null;
};

function blockContent(root: HTMLElement, index: number) {
  return root.querySelector<HTMLElement>(`[${BLOCK_CONTENT_ATTR}="${index}"]`);
}

function guideTextNodes(content: HTMLElement) {
  const walker = content.ownerDocument.createTreeWalker(
    content,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    (node) => {
      if (!(node instanceof Element)) return NodeFilter.FILTER_ACCEPT;
      return node.hasAttribute(GUIDE_UI_ATTR)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_SKIP;
    }
  );

  const nodes: Array<Text> = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    nodes.push(node as Text);
  }
  return nodes;
}

function textOf(content: HTMLElement) {
  let text = "";
  for (const node of guideTextNodes(content)) text += node.data;
  return text;
}

function sourceOffsets(first: HTMLElement, last: HTMLElement) {
  const start = first.getAttribute(BLOCK_SOURCE_START_ATTR);
  const end = last.getAttribute(BLOCK_SOURCE_END_ATTR);

  if (!start || !end) return { source_start: null, source_end: null };
  return { source_start: Number(start), source_end: Number(end) };
}

// Text in the navbar, the sidebar, or a comment card never makes a passage.
function insideGuideText(root: HTMLElement, node: Node) {
  const element = node instanceof Element ? node : node.parentElement;
  return (
    !!element &&
    root.contains(element) &&
    !element.closest(`[${ANNOTATION_UI_ATTR}]`)
  );
}

// A point inside guide UI gets the offset of the guide text before that UI.
function textOffset(content: HTMLElement, node: Node, offset: number) {
  const before = content.ownerDocument.createRange();
  before.selectNodeContents(content);
  before.setEnd(node, offset);

  let length = 0;
  for (const text of guideTextNodes(content)) {
    if (text === node) return length + offset;
    if (!before.intersectsNode(text)) break;
    length += text.data.length;
  }
  return length;
}

function quoteOf(blocks: Array<HTMLElement>, start: number, end: number) {
  const last = blocks.length - 1;

  return blocks
    .map((content, i) =>
      textOf(content).slice(i === 0 ? start : 0, i === last ? end : undefined)
    )
    .join("\n");
}

// The parts of the guide text nodes of a block that fall in [from, to).
function textParts(content: HTMLElement, from: number, to: number) {
  const parts: Array<{ node: Text; start: number; end: number }> = [];
  let position = 0;

  for (const node of guideTextNodes(content)) {
    const start = Math.max(from - position, 0);
    const end = Math.min(to - position, node.data.length);
    position += node.data.length;
    if (start < end) parts.push({ node, start, end });
  }
  return parts;
}

// Whether guide text in [from, to) shows on screen. List and blockquote markup
// puts line breaks around items that show nothing; whitespace in code shows.
function showsText(content: HTMLElement, from: number, to: number) {
  for (const { node, start, end } of textParts(content, from, to)) {
    if (node.data.slice(start, end).trim() !== "") return true;
    if (node.parentElement?.closest("pre")) return true;
  }
  return false;
}

export function anchorFromSelection(
  selection: Selection | null,
  root: HTMLElement
): PassageAnchor | null {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed)
    return null;

  const range = selection.getRangeAt(0);

  if (
    !insideGuideText(root, range.startContainer) ||
    !insideGuideText(root, range.endContainer)
  )
    return null;

  const blocks = Array.from(
    root.querySelectorAll<HTMLElement>(`[${BLOCK_CONTENT_ATTR}]`)
  ).filter((content) => range.intersectsNode(content));

  if (blocks.length === 0) return null;

  let start = blocks[0].contains(range.startContainer)
    ? textOffset(blocks[0], range.startContainer, range.startOffset)
    : 0;
  let last = blocks[blocks.length - 1];
  let end = last.contains(range.endContainer)
    ? textOffset(last, range.endContainer, range.endOffset)
    : textOf(last).length;

  // A triple click selects up to the start of the next block. Edge blocks that
  // show none of the selected text are not part of the passage.
  if (blocks.length > 1 && !showsText(last, 0, end)) {
    blocks.pop();
    last = blocks[blocks.length - 1];
    end = textOf(last).length;
  }
  if (blocks.length > 1 && !showsText(blocks[0], start, Infinity)) {
    blocks.shift();
    start = 0;
  }

  const quote = quoteOf(blocks, start, end);

  if (quote.trim() === "") return null;

  return {
    kind: "passage",
    start_block: Number(blocks[0].getAttribute(BLOCK_CONTENT_ATTR)),
    start_offset: start,
    end_block: Number(last.getAttribute(BLOCK_CONTENT_ATTR)),
    end_offset: end,
    quote,
    ...sourceOffsets(blocks[0], last),
  };
}

// The keyboard, screen reader, and image path: the whole block is the passage.
export function blockAnchor(
  root: HTMLElement,
  index: number
): PassageAnchor | null {
  const content = blockContent(root, index);
  if (!content) return null;

  const text = textOf(content);

  return {
    kind: "block",
    start_block: index,
    start_offset: 0,
    end_block: index,
    end_offset: text.length,
    // The API takes at most REVIEW_QUOTE_MAX_LENGTH UTF-16 units of a quote;
    // a longer block keeps the start of its text and its full length.
    quote: text.slice(0, REVIEW_QUOTE_MAX_LENGTH),
    ...sourceOffsets(content, content),
  };
}

export function blocksAnchor(
  root: HTMLElement,
  start: number,
  end: number
): PassageAnchor | null {
  if (start === end) return blockAnchor(root, start);
  const blocks = blockRange(root, { start_block: start, end_block: end });
  if (!blocks) return null;

  const last = blocks[blocks.length - 1];
  const endOffset = textOf(last).length;
  return {
    kind: "passage",
    start_block: start,
    start_offset: 0,
    end_block: end,
    end_offset: endOffset,
    quote: quoteOf(blocks, 0, endOffset),
    ...sourceOffsets(blocks[0], last),
  };
}

function blockRange(
  root: HTMLElement,
  anchor: Pick<PassageAnchor, "start_block" | "end_block">
) {
  const blocks: Array<HTMLElement> = [];

  for (let i = anchor.start_block; i <= anchor.end_block; i++) {
    const content = blockContent(root, i);
    if (!content) return null;
    blocks.push(content);
  }

  return blocks.length === 0 ? null : blocks;
}

// True while the guide text still reads the quote at the anchor offsets.
// enough: a block anchor checks the quoted start of its block and the block
// length, so an edit past REVIEW_QUOTE_MAX_LENGTH units that keeps the length
// still holds. Store a digest of the block text to catch that edit.
export function anchorHolds(root: HTMLElement, anchor: PassageAnchor) {
  const blocks = blockRange(root, anchor);
  if (!blocks) return false;

  if (anchor.kind === "block") {
    const text = textOf(blocks[0]);
    return (
      blocks.length === 1 &&
      text.length === anchor.end_offset &&
      text.startsWith(anchor.quote)
    );
  }

  const last = blocks[blocks.length - 1];

  if (
    anchor.start_offset > textOf(blocks[0]).length ||
    anchor.end_offset > textOf(last).length
  )
    return false;

  return (
    quoteOf(blocks, anchor.start_offset, anchor.end_offset) === anchor.quote
  );
}

function pointAt(content: HTMLElement, offset: number) {
  let remaining = offset;

  for (const node of guideTextNodes(content)) {
    const length = node.data.length;
    if (remaining <= length) return { node, offset: remaining };
    remaining -= length;
  }

  return remaining === 0 ? { node: content as Node, offset: 0 } : null;
}

// A fresh Range over the whole passage. Callers rebuild it from the anchor
// after each render instead of keeping it. The Range also covers comment cards
// and guide UI between its ends, so highlights paint guideTextRanges instead.
export function rangeFromAnchor(root: HTMLElement, anchor: PassageAnchor) {
  const blocks = blockRange(root, anchor);
  if (!blocks) return null;

  const start = pointAt(blocks[0], anchor.start_offset);
  const end = pointAt(blocks[blocks.length - 1], anchor.end_offset);

  if (!start || !end) return null;

  const range = root.ownerDocument.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return range;
}

// The guide text of an anchor as one Range per text node, for painting a
// highlight without comment cards or guide UI. An anchor whose offsets no
// longer fit its blocks gets no ranges.
export function guideTextRanges(
  root: HTMLElement,
  anchor: PassageAnchor
): Array<Range> {
  const blocks = blockRange(root, anchor);
  if (!blocks) return [];

  const last = blocks.length - 1;

  if (
    anchor.start_offset > textOf(blocks[0]).length ||
    anchor.end_offset > textOf(blocks[last]).length
  )
    return [];

  const ranges: Array<Range> = [];
  for (const [i, content] of blocks.entries()) {
    const from = i === 0 ? anchor.start_offset : 0;
    const to = i === last ? anchor.end_offset : Infinity;

    for (const { node, start, end } of textParts(content, from, to)) {
      const range = root.ownerDocument.createRange();
      range.setStart(node, start);
      range.setEnd(node, end);
      ranges.push(range);
    }
  }
  return ranges;
}

// The API takes source offsets only on the line edges of non-blank text. A
// block whose position fails that (raw HTML can shift it) keeps its comments
// anchored by guide text alone, and takes no suggested edits.
export function sourceRangeFits(
  body: string,
  start: number | null,
  end: number | null
) {
  if (start === null || end === null || start >= end || end > body.length)
    return false;

  const lineStart = body.lastIndexOf("\n", start - 1) + 1;
  const nextBreak = body.indexOf("\n", end);
  const lineEnd = nextBreak === -1 ? body.length : nextBreak;

  return (
    /^[ \t]*$/.test(body.slice(lineStart, start)) &&
    /^[ \t\r]*$/.test(body.slice(end, lineEnd)) &&
    body.slice(start, end).trim() !== ""
  );
}
