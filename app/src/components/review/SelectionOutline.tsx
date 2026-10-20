import { useLayoutEffect, useState } from "react";

import { useReviewAnnotations } from "@/components/review/ReviewAnnotations";
import { BLOCK_CONTENT_ATTR } from "@/lib/reviewAnchors";

type Bounds = { x: number; y: number; width: number; height: number };

export const SelectionOutline = () => {
  const { rootRef, selection, draft, activeBlock, expanded } =
    useReviewAnnotations();
  const anchor = draft?.anchor ?? selection;
  const start = anchor?.start_block ?? activeBlock;
  const end = anchor?.end_block ?? activeBlock;
  const [bounds, setBounds] = useState<Bounds | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;

    if (!root || start === null || end === null) {
      setBounds(null);
      return;
    }

    const first = root.querySelector(`[${BLOCK_CONTENT_ATTR}="${start}"]`);
    const last = root.querySelector(`[${BLOCK_CONTENT_ATTR}="${end}"]`);

    if (!first || !last) {
      setBounds(null);
      return;
    }

    const measure = () => {
      const origin = root.getBoundingClientRect();
      const top = first.getBoundingClientRect();
      const bottom = last.getBoundingClientRect();
      const left = Math.min(top.left, bottom.left);
      const right = Math.max(top.right, bottom.right);
      const next = {
        x: left - origin.left - 4,
        y: top.top - origin.top - 4,
        width: right - left + 8,
        height: bottom.bottom - top.top + 8,
      };

      setBounds((previous) => {
        const unchanged =
          previous?.x === next.x &&
          previous.y === next.y &&
          previous.width === next.width &&
          previous.height === next.height;
        return unchanged ? previous : next;
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    observer.observe(first);
    observer.observe(last);
    return () => observer.disconnect();
  }, [rootRef, start, end, expanded]);

  if (!bounds) return null;

  return (
    <svg
      aria-hidden
      data-review-selection-outline
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
    >
      <rect
        x={bounds.x}
        y={bounds.y}
        width={bounds.width}
        height={bounds.height}
        rx={8}
        strokeWidth={2}
        className="fill-brand-bright-blue/10 stroke-brand-bright-blue"
      />
    </svg>
  );
};
