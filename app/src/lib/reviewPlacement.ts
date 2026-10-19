import type {
  ReviewAnnotationsData,
  ReviewSuggestion,
  ReviewThread,
} from "@/lib/api/reviewAnnotations";
import type { PassageAnchor } from "@/lib/reviewAnchors";
import { anchorHolds, guideTextRanges } from "@/lib/reviewAnchors";

export type AnnotationItem =
  | { type: "thread"; id: string; anchor: PassageAnchor; thread: ReviewThread }
  | {
      type: "suggestion";
      id: string;
      anchor: PassageAnchor;
      suggestion: ReviewSuggestion;
    };

export type MarkedPassage = {
  start: number;
  end: number;
  items: Array<AnnotationItem>;
};

export type Placement = {
  placed: Map<number, Array<AnnotationItem>>;
  passages: Map<number, MarkedPassage>;
  detached: Array<AnnotationItem>;
  itemCount: number;
};

// An anchor goes in the text only while the server calls it current, it
// belongs to the revision on screen, and the rendered text still reads its
// quote. Anything else is listed apart and never moves to other text.
export function placeItems(
  data: ReviewAnnotationsData,
  revisionId: string,
  root: HTMLElement
): Placement {
  const attached: Array<AnnotationItem> = [];
  const detached: Array<AnnotationItem> = [];

  const items: Array<
    AnnotationItem & { revisionId: string; anchorStatus: string }
  > = [
    ...data.threads.map((thread) => ({
      type: "thread" as const,
      id: thread.id,
      anchor: thread.anchor,
      thread,
      revisionId: thread.revision_id,
      anchorStatus: thread.anchor_status,
    })),
    ...data.suggestions.map((suggestion) => ({
      type: "suggestion" as const,
      id: suggestion.id,
      anchor: suggestion.anchor,
      suggestion,
      revisionId: suggestion.revision_id,
      anchorStatus: suggestion.anchor_status,
    })),
  ];

  for (const item of items) {
    const inText =
      item.anchorStatus === "current" &&
      item.revisionId === revisionId &&
      anchorHolds(root, item.anchor);

    if (!inText) {
      detached.push(item);
      continue;
    }

    attached.push(item);
  }

  const placed = new Map<number, Array<AnnotationItem>>();
  const byBlock = new Map<number, Array<AnnotationItem>>();
  for (const item of attached) {
    const end = item.anchor.end_block;
    const badges = placed.get(end) ?? [];
    badges.push(item);
    placed.set(end, badges);
    for (let index = item.anchor.start_block; index <= end; index++) {
      const covering = byBlock.get(index) ?? [];
      covering.push(item);
      byBlock.set(index, covering);
    }
  }

  const passages = new Map<number, MarkedPassage>();
  let previous: MarkedPassage | undefined;
  for (const [index, covering] of [...byBlock].sort(([a], [b]) => a - b)) {
    const sameComments =
      previous?.end === index - 1 &&
      previous.items.length === covering.length &&
      previous.items.every((item, position) => item === covering[position]);
    if (previous && sameComments) {
      previous.end = index;
    } else {
      previous = { start: index, end: index, items: covering };
    }
    passages.set(index, previous);
  }

  return { placed, passages, detached, itemCount: items.length };
}

// Paints passages with the CSS Custom Highlight API, which leaves the DOM and
// the reader's native selection alone. Ranges are rebuilt from the anchors on
// every paint and never kept between renders.
export function paintHighlights(
  root: HTMLElement,
  groups: Array<[name: string, anchors: Array<PassageAnchor>]>
) {
  if (typeof CSS === "undefined" || !("highlights" in CSS)) return;

  for (const [name, anchors] of groups) {
    const ranges = anchors.flatMap((anchor) => guideTextRanges(root, anchor));

    if (ranges.length === 0) CSS.highlights.delete(name);
    else CSS.highlights.set(name, new Highlight(...ranges));
  }
}
