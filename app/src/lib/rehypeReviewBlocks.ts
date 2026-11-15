// The app does not depend on @types/hast, so name only the fields used here.
type HastChild = {
  type: string;
  position?: {
    start: { offset?: number };
    end: { offset?: number };
  };
};

export type ReviewBlockProperties = {
  index: number;
  start: number | null;
  end: number | null;
};

// Wraps each top-level block of a guide body in a <review-block> element, so
// the review page can hang passage comments under the block they quote. Each
// wrapper carries the UTF-16 offsets of its block in the markdown body. An
// anchor keeps these offsets only when sourceRangeFits accepts them. A block
// that a plugin made (no source position) keeps null offsets.
export function rehypeReviewBlocks() {
  return (tree: { children: Array<HastChild> }) => {
    let index = 0;

    tree.children = tree.children.map((child) => {
      if (child.type !== "element") return child;

      const properties: ReviewBlockProperties = {
        index: index++,
        start: child.position?.start.offset ?? null,
        end: child.position?.end.offset ?? null,
      };

      return {
        type: "element",
        tagName: "review-block",
        properties,
        children: [child],
      };
    });
  };
}
