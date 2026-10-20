import { useEffect, useMemo, useRef } from "react";
import { MessageSquarePlus, PencilLine, X } from "lucide-react";
import { REVIEW_QUOTE_MAX_LENGTH } from "@bluelearn/schemas";
import type { MouseEvent } from "react";

import type { PassageAnchor } from "@/lib/reviewAnchors";
import { useReviewAnnotations } from "@/components/review/ReviewAnnotations";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  ANNOTATION_UI_ATTR,
  BLOCK_CONTENT_ATTR,
  anchorFromSelection,
  blockAnchor,
  blocksAnchor,
  sourceRangeFits,
} from "@/lib/reviewAnchors";

function sameAnchor(a: PassageAnchor | null, b: PassageAnchor | null) {
  return (
    a === b ||
    (!!a &&
      !!b &&
      a.start_block === b.start_block &&
      a.start_offset === b.start_offset &&
      a.end_block === b.end_block &&
      a.end_offset === b.end_offset)
  );
}

export const SelectionCommentAction = () => {
  const {
    rootRef,
    revisionBody,
    permissions,
    draft,
    openDraft,
    selection: candidate,
    setSelection: setCandidate,
    blockSelection,
    selectionControls,
  } = useReviewAnnotations();
  const barRef = useRef<HTMLDivElement>(null);
  // On touch screens a press on the action can clear the selection before
  // the click lands, so the anchor taken before the press must stay.
  const pressing = useRef(false);
  const virtualAnchor = useMemo(() => {
    const root = rootRef.current;

    return {
      current: {
        contextElement: root ?? undefined,
        getBoundingClientRect: () => {
          const lastBlock =
            candidate &&
            root?.querySelector(
              `[${BLOCK_CONTENT_ATTR}="${candidate.end_block}"]`
            );

          return lastBlock?.getBoundingClientRect() ?? new DOMRect();
        },
      },
    };
  }, [candidate, rootRef]);

  useEffect(() => {
    const update = () => {
      if (pressing.current) return;
      if (blockSelection && document.getSelection()?.isCollapsed) return;

      const root = rootRef.current;
      const selected = root
        ? anchorFromSelection(document.getSelection(), root)
        : null;
      const next =
        root && selected
          ? blocksAnchor(root, selected.start_block, selected.end_block)
          : null;
      setCandidate((prev) => (sameAnchor(prev, next) ? prev : next));
    };
    const release = (event: PointerEvent) => {
      if (!barRef.current?.contains(event.target as Node))
        pressing.current = false;
    };

    document.addEventListener("selectionchange", update);
    document.addEventListener("pointerdown", release, true);
    return () => {
      document.removeEventListener("selectionchange", update);
      document.removeEventListener("pointerdown", release, true);
    };
  }, [rootRef, setCandidate, blockSelection]);

  if (
    !permissions.can_comment ||
    !candidate ||
    draft ||
    selectionControls.dragging
  )
    return null;

  const tooLong = candidate.quote.length > REVIEW_QUOTE_MAX_LENGTH;
  const textlessRange =
    candidate.kind === "passage" && candidate.quote.trim() === "";
  const blockSource =
    candidate.start_block === candidate.end_block && rootRef.current
      ? blockAnchor(rootRef.current, candidate.start_block)
      : null;
  const canSuggest =
    permissions.can_suggest &&
    !!blockSource &&
    sourceRangeFits(
      revisionBody,
      blockSource.source_start,
      blockSource.source_end
    );

  const start = (mode: "comment" | "suggestion") => {
    pressing.current = false;
    const anchor = mode === "comment" ? candidate : blockSource;

    if (!anchor) return;

    setCandidate(null);
    openDraft({ mode, anchor });
  };

  const keepSelection = {
    onPointerDown: () => {
      pressing.current = true;
    },
    // Stops a mouse press from moving focus and clearing the selection.
    onMouseDown: (event: MouseEvent) => event.preventDefault(),
  };

  return (
    <Popover
      open
      onOpenChange={(open) => {
        if (!open) setCandidate(null);
      }}
    >
      <PopoverAnchor virtualRef={virtualAnchor} />
      <PopoverContent
        ref={barRef}
        role="toolbar"
        aria-label="Review selected passage"
        {...{ [ANNOTATION_UI_ATTR]: "" }}
        side="bottom"
        sideOffset={blockSelection ? 32 : 20}
        collisionPadding={12}
        updatePositionStrategy="always"
        hideWhenDetached
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onFocusOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          // A page swipe must scroll without discarding the snapped range.
          if (blockSelection) event.preventDefault();
        }}
        className="w-max max-w-[calc(100vw-1.5rem)] gap-2 rounded-xl border border-border/60 bg-background p-1.5 shadow-sm ring-0 data-open:animate-[review-selection-toolbar_140ms_ease-out]! motion-reduce:data-open:animate-none! motion-reduce:data-closed:animate-none!"
      >
        {tooLong && (
          <p role="status" className="px-3 py-2 text-xs">
            Select {REVIEW_QUOTE_MAX_LENGTH} characters or fewer to comment.
          </p>
        )}
        {textlessRange && (
          <p role="status" className="px-3 py-2 text-xs">
            Comment on each image individually, or include text in the
            selection.
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            type="button"
            className="min-h-11 rounded-full px-4"
            disabled={tooLong || textlessRange}
            {...keepSelection}
            onClick={() => start("comment")}
          >
            <MessageSquarePlus aria-hidden />
            Comment on selection
          </Button>
          {canSuggest && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 rounded-full px-4"
              {...keepSelection}
              onClick={() => start("suggestion")}
            >
              <PencilLine aria-hidden />
              Suggest edit
            </Button>
          )}
          {blockSelection && (
            <Button
              type="button"
              variant="ghost"
              className="size-11 rounded-full"
              aria-label="Clear selection"
              onClick={() => setCandidate(null)}
            >
              <X aria-hidden />
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
