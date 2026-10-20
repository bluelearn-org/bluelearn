import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, RefObject } from "react";

import type { PassageAnchor } from "@/lib/reviewAnchors";
import { BLOCK_CONTENT_ATTR } from "@/lib/reviewAnchors";

type Edge = "start" | "end";
type Options = {
  rootRef: RefObject<HTMLDivElement | null>;
  selection: PassageAnchor | null;
  enabled: boolean;
  selectBlocks: (start: number, end: number) => void;
  clear: () => void;
};
type Block = { index: number; element: HTMLElement };
type Drag = {
  pointerId: number;
  edge: Edge;
  fixed: number;
  y: number;
  grabOffset: number;
  lastTime: number;
  frame: number;
  blocks: Array<Block>;
};

const EDGE_SCROLL_ZONE = 64;
const MAX_SCROLL_SPEED = 480;

export function useBlockSelection(options: Options) {
  const latest = useRef(options);
  latest.current = options;
  const drag = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState(false);

  const stop = useCallback(() => {
    const current = drag.current;
    if (!current) return;

    drag.current = null;
    cancelAnimationFrame(current.frame);

    const root = latest.current.rootRef.current;
    if (root?.hasPointerCapture(current.pointerId))
      root.releasePointerCapture(current.pointerId);

    setDragging(false);
  }, []);

  const startDrag = useCallback(
    (edge: Edge, event: PointerEvent<HTMLButtonElement>) => {
      const { rootRef, selection, enabled } = latest.current;
      const root = rootRef.current;

      if (!enabled || !selection || !root) return;
      if (event.button !== 0 || drag.current) return;

      event.preventDefault();
      event.stopPropagation();

      const blocks = readBlocks(root);
      const movingIndex =
        edge === "start" ? selection.start_block : selection.end_block;
      const movingBlock = blocks.find((block) => block.index === movingIndex);

      if (!movingBlock) return;

      const bounds = movingBlock.element.getBoundingClientRect();
      const boundary = edge === "start" ? bounds.top : bounds.bottom;

      // A grip moves to another block mid-drag; the guide must keep capture.
      root.setPointerCapture(event.pointerId);
      const current: Drag = {
        pointerId: event.pointerId,
        edge,
        fixed: edge === "start" ? selection.end_block : selection.start_block,
        y: event.clientY,
        grabOffset: event.clientY - boundary,
        lastTime: performance.now(),
        frame: 0,
        blocks,
      };
      drag.current = current;
      setDragging(true);

      const tick = (time: number) => {
        if (drag.current !== current) return;
        if (!latest.current.enabled) {
          stop();
          return;
        }

        const elapsed = Math.min(32, time - current.lastTime);
        current.lastTime = time;
        scrollAtEdge(current.y, elapsed);
        snapToPointer(current, latest.current);
        current.frame = requestAnimationFrame(tick);
      };
      current.frame = requestAnimationFrame(tick);
    },
    [stop]
  );

  const adjustWithKeyboard = useCallback(
    (edge: Edge, event: KeyboardEvent<HTMLButtonElement>) => {
      const { rootRef, selection, enabled, selectBlocks, clear } =
        latest.current;
      const root = rootRef.current;

      if (!enabled || !selection || !root) return;

      const current =
        edge === "start" ? selection.start_block : selection.end_block;

      if (event.key === "Escape") {
        event.preventDefault();
        clear();
        // Clearing removes this grip. Its block's actions take the focus, the
        // same place a cancelled draft returns it to.
        root
          .querySelector<HTMLElement>(
            `[data-review-block="${current}"] [data-review-block-actions] button`
          )
          ?.focus({ preventScroll: true });
        return;
      }

      const count = root.querySelectorAll(`[${BLOCK_CONTENT_ATTR}]`).length;
      const next = keyboardTarget(event.key, current, count);

      if (next === null) return;

      event.preventDefault();

      const fixed =
        edge === "start" ? selection.end_block : selection.start_block;
      const { start, end } = boundedRange(edge, next, fixed);
      selectBlocks(start, end);

      // Resizing replaces the boundary button. Keep keyboard focus on its new owner.
      requestAnimationFrame(() => {
        if (!root.isConnected) return;
        const grip = root.querySelector<HTMLButtonElement>(
          `[data-review-selection-grip="${edge}"]`
        );
        grip?.focus({ preventScroll: true });
        grip?.scrollIntoView({ block: "nearest", behavior: "instant" });
      });
    },
    []
  );

  useEffect(() => {
    if (!options.enabled) stop();
  }, [options.enabled, stop]);

  useEffect(() => {
    const move = (event: globalThis.PointerEvent) => {
      const current = drag.current;
      if (!current || event.pointerId !== current.pointerId) return;

      event.preventDefault();
      current.y = event.clientY;
    };
    const finish = (event: globalThis.PointerEvent) => {
      const current = drag.current;
      if (!current || event.pointerId !== current.pointerId) return;

      // A quick release can arrive before the next animation frame.
      current.y = event.clientY;
      snapToPointer(current, latest.current);
      stop();
    };
    const cancel = (event: globalThis.PointerEvent) => {
      if (event.pointerId === drag.current?.pointerId) stop();
    };

    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("lostpointercapture", cancel);

    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("lostpointercapture", cancel);
      stop();
    };
  }, [stop]);

  return useMemo(
    () => ({ dragging, startDrag, adjustWithKeyboard }),
    [dragging, startDrag, adjustWithKeyboard]
  );
}

function readBlocks(root: HTMLElement): Array<Block> {
  const elements = root.querySelectorAll<HTMLElement>(
    `[${BLOCK_CONTENT_ATTR}]`
  );
  return Array.from(elements, (element) => ({
    element,
    index: Number(element.getAttribute(BLOCK_CONTENT_ATTR)),
  }));
}

function boundedRange(edge: Edge, index: number, fixed: number) {
  if (edge === "start") return { start: Math.min(index, fixed), end: fixed };
  return { start: fixed, end: Math.max(index, fixed) };
}

function snapToPointer(drag: Drag, options: Options) {
  if (!options.enabled || !options.selection) return;

  // Grips sit outside the text; keep the grabbed boundary under the same finger.
  const boundaryY = drag.y - drag.grabOffset;
  let nearest: number | null = null;
  let distance = Infinity;
  for (const block of drag.blocks) {
    const rect = block.element.getBoundingClientRect();
    const nextDistance = Math.max(
      rect.top - boundaryY,
      boundaryY - rect.bottom,
      0
    );
    if (nextDistance >= distance) continue;

    nearest = block.index;
    distance = nextDistance;
    if (distance === 0) break;
  }
  if (nearest === null) return;

  const { start, end } = boundedRange(drag.edge, nearest, drag.fixed);
  const unchanged =
    options.selection.start_block === start &&
    options.selection.end_block === end;
  if (!unchanged) options.selectBlocks(start, end);
}

function scrollAtEdge(y: number, elapsed: number) {
  const viewport = window.visualViewport;
  const top = viewport?.offsetTop ?? 0;
  const bottom = top + (viewport?.height ?? window.innerHeight);
  let speed = 0;

  if (y < top + EDGE_SCROLL_ZONE)
    speed = -Math.min(1, (top + EDGE_SCROLL_ZONE - y) / EDGE_SCROLL_ZONE);
  else if (y > bottom - EDGE_SCROLL_ZONE)
    speed = Math.min(1, (y - bottom + EDGE_SCROLL_ZONE) / EDGE_SCROLL_ZONE);
  else return;

  window.scrollBy({
    top: (speed * MAX_SCROLL_SPEED * elapsed) / 1000,
    behavior: "instant",
  });
}

function keyboardTarget(key: string, current: number, count: number) {
  switch (key) {
    case "ArrowUp":
      return Math.max(0, current - 1);
    case "ArrowDown":
      return Math.min(count - 1, current + 1);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
