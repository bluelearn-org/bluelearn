import { flushSync } from "react-dom";
import { ChevronDown, MessageSquare, PencilLine } from "lucide-react";
import type { MouseEvent } from "react";

import type { GuideBlockProps } from "@/components/GuideReader";
import type { AnnotationItem } from "@/lib/reviewPlacement";
import {
  ReviewerBadge,
  badgeId,
  cardId,
} from "@/components/review/AnnotationParts";
import { DraftCard } from "@/components/review/DraftCard";
import { useReviewAnnotations } from "@/components/review/ReviewAnnotations";
import { SuggestionCard } from "@/components/review/SuggestionCard";
import { ThreadCard } from "@/components/review/ThreadCard";
import {
  ANNOTATION_UI_ATTR,
  BLOCK_CONTENT_ATTR,
  BLOCK_SOURCE_END_ATTR,
  BLOCK_SOURCE_START_ATTR,
  sourceRangeFits,
} from "@/lib/reviewAnchors";
import { liveMessageCount } from "@/lib/reviewPlacement";
import { cn } from "@/lib/utils";

const STATUS_LABELS = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Rejected",
};

const AnnotationBadge = ({ item }: { item: AnnotationItem }) => {
  const { expanded, toggle } = useReviewAnnotations();
  const open = expanded.has(item.id);
  const author =
    item.type === "thread" ? item.thread.author : item.suggestion.author;
  const messageCount =
    item.type === "thread" ? liveMessageCount(item.thread) : 0;

  return (
    <button
      id={badgeId(item.id)}
      type="button"
      style={{ viewTransitionName: badgeId(item.id) }}
      aria-expanded={open}
      aria-controls={open ? cardId(item.id) : undefined}
      onClick={() => toggle(item.id)}
      className="group -my-[9px] inline-flex min-h-11 max-w-full items-center rounded-md text-xs [view-transition-class:review-motion] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span
        className={cn(
          "inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-md border border-brand-bright-blue/25 bg-background px-2 py-1 transition-colors group-hover:bg-muted [&_.mono-micro]:sr-only",
          open && "border-brand-bright-blue/60 bg-muted"
        )}
      >
        <ReviewerBadge participant={author} />
        {item.type === "thread" ? (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 text-muted-foreground",
              open && "sr-only"
            )}
          >
            <MessageSquare aria-hidden className="size-3.5" />
            {messageCount}
            <span className="sr-only">
              {messageCount === 1 ? "comment" : "comments"}
            </span>
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1 text-muted-foreground">
            <PencilLine aria-hidden className="size-3.5" />
            <span className="sr-only">
              Edit · {STATUS_LABELS[item.suggestion.status]}
            </span>
            <span aria-hidden>{STATUS_LABELS[item.suggestion.status]}</span>
          </span>
        )}
        <ChevronDown
          aria-hidden
          className={cn(
            "size-4 shrink-0 transition-transform motion-reduce:transition-none",
            open && "rotate-180"
          )}
        />
      </span>
    </button>
  );
};

const SelectionGrip = ({
  edge,
  position,
}: {
  edge: "start" | "end";
  position: "left" | "center" | "right";
}) => {
  const { selectionControls } = useReviewAnnotations();
  const handle = `${edge}-${position}`;
  const dragging = selectionControls.draggingHandle === handle;

  return (
    <button
      type="button"
      aria-label={`Adjust selection ${edge} (${position})`}
      title="Drag to snap to a block. Use Up and Down arrows to adjust; Escape clears the selection."
      data-review-selection-grip={edge}
      data-review-selection-handle={handle}
      data-dragging={dragging ? "" : undefined}
      {...{ [ANNOTATION_UI_ATTR]: "" }}
      className={cn(
        "group absolute z-30 size-11 cursor-ns-resize touch-none rounded-lg outline-none select-none",
        edge === "start" ? "-top-[37px]" : "-bottom-[37px]",
        position === "left" && "-left-[26px]",
        position === "center" && "left-1/2 -translate-x-1/2",
        position === "right" && "-right-[26px]"
      )}
      onPointerDown={(event) =>
        selectionControls.startDrag(edge, event, handle)
      }
      onKeyDown={(event) =>
        selectionControls.adjustWithKeyboard(edge, event, handle)
      }
      onClick={(event) => event.stopPropagation()}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute size-3.5 border-brand-bright-blue/70 transition-[border-color,background-color,box-shadow,scale] duration-100 group-hover:border-brand-bright-blue group-focus-visible:border-brand-bright-blue group-focus-visible:bg-brand-bright-blue/10 group-focus-visible:ring-2 group-focus-visible:ring-brand-bright-blue/40 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background group-active:scale-90 group-data-[dragging]:scale-90 group-data-[dragging]:border-brand-bright-blue motion-reduce:transition-none motion-reduce:group-active:scale-100 motion-reduce:group-data-[dragging]:scale-100",
          edge === "start"
            ? "top-[31.5px] border-t-[3px]"
            : "bottom-[31.5px] border-b-[3px]",
          position === "center" && "left-1/2 h-0 w-5 -translate-x-1/2",
          position === "left" && "left-[20.5px] border-l-[3px]",
          position === "right" && "right-[20.5px] border-r-[3px]",
          position === "left" &&
            (edge === "start" ? "rounded-tl-[9.5px]" : "rounded-bl-[9.5px]"),
          position === "right" &&
            (edge === "start" ? "rounded-tr-[9.5px]" : "rounded-br-[9.5px]")
        )}
      />
    </button>
  );
};

// Keep paragraph nodes stable; only the passage frame and its end controls change.
export const AnnotatedBlock = ({
  index,
  start,
  end,
  children,
}: GuideBlockProps) => {
  const {
    rootRef,
    revisionBody,
    permissions,
    placed,
    passages,
    expanded,
    draft,
    selection,
    blockSelection,
    selectBlocks,
    closeDraft,
  } = useReviewAnnotations();

  const items = placed.get(index) ?? [];
  const passage = passages.get(index);
  const marked = !!passage;
  const first = passage?.start === index;
  const last = passage?.end === index;
  const activeMark = passage?.items.some((item) => expanded.has(item.id));

  const draftEnd = draft
    ? (passages.get(draft.anchor.end_block)?.end ?? draft.anchor.end_block)
    : null;
  const composing = draftEnd === index ? draft : null;

  const selectedAnchor = draft?.anchor ?? selection;
  const selected =
    !!selectedAnchor &&
    index >= selectedAnchor.start_block &&
    index <= selectedAnchor.end_block;

  const canSuggest =
    permissions.can_suggest && sourceRangeFits(revisionBody, start, end);
  const hasActions = permissions.can_comment || canSuggest;

  // Only the grips own dragging. Ordinary taps select, and swipes keep scrolling.
  const activate = (event: MouseEvent<HTMLDivElement>) => {
    if (!hasActions || draft) return;
    const target = event.target as Element;

    if (
      target.closest(
        `[${ANNOTATION_UI_ATTR}], a, button, input, textarea, select, [contenteditable="true"]`
      )
    )
      return;
    if (!document.getSelection()?.isCollapsed) return;

    selectBlocks(index, index);
  };

  const cancelDraft = () => {
    if (!composing) return;

    const { anchor, mode } = composing;
    flushSync(() => {
      closeDraft();
      selectBlocks(anchor.start_block, anchor.end_block);
    });
    rootRef.current
      ?.querySelector<HTMLElement>(
        `[${BLOCK_CONTENT_ATTR}="${anchor.end_block}"]`
      )
      ?.focus();
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-review-selection-action="${mode}"]`)
        ?.focus({ preventScroll: true });
    });
  };

  return (
    <div
      data-review-block={index}
      className="relative [view-transition-class:review-motion]"
      style={{ viewTransitionName: `review-block-${index}` }}
      onClick={activate}
    >
      <div className="relative isolate">
        {marked && (
          <div
            aria-hidden
            data-review-passage-frame
            data-passage-start={passage.start}
            data-passage-end={passage.end}
            className={cn(
              "pointer-events-none absolute -inset-x-1 inset-y-0 -z-10 border-x",
              first && "-top-1 rounded-t-md border-t",
              last && "-bottom-1 rounded-b-md border-b",
              activeMark
                ? "border-brand-bright-blue/60 bg-muted/60"
                : "border-brand-bright-blue/30"
            )}
          />
        )}
        <div
          {...{
            [BLOCK_CONTENT_ATTR]: index,
            [BLOCK_SOURCE_START_ATTR]: start ?? undefined,
            [BLOCK_SOURCE_END_ATTR]: end ?? undefined,
          }}
          data-review-selected={selected ? "" : undefined}
          tabIndex={hasActions && !draft ? 0 : undefined}
          role={hasActions ? "group" : undefined}
          aria-label={
            hasActions ? `Select block ${index + 1} for review` : undefined
          }
          onKeyDown={(event) => {
            if (!hasActions || draft || event.target !== event.currentTarget)
              return;
            if (event.key !== "Enter" && event.key !== " ") return;

            event.preventDefault();
            selectBlocks(index, index);
            requestAnimationFrame(() => {
              document
                .querySelector<HTMLElement>("[data-review-selection-action]")
                ?.focus({ preventScroll: true });
            });
          }}
          style={{ viewTransitionName: `review-source-${index}` }}
          className={cn(
            "rounded-md outline-none [view-transition-class:review-motion] focus-visible:ring-2 focus-visible:ring-ring",
            marked && "px-3 [&>:first-child]:mt-0 [&>:last-child]:mb-0",
            marked && (first ? "pt-3" : "pt-2"),
            marked && (last ? "pb-3" : "pb-2")
          )}
        >
          {children}
        </div>
        {blockSelection && !draft && hasActions && (
          <>
            {selection?.start_block === index && (
              <>
                <SelectionGrip edge="start" position="left" />
                <SelectionGrip edge="start" position="center" />
                <SelectionGrip edge="start" position="right" />
              </>
            )}
            {selection?.end_block === index && (
              <>
                <SelectionGrip edge="end" position="left" />
                <SelectionGrip edge="end" position="center" />
                <SelectionGrip edge="end" position="right" />
              </>
            )}
          </>
        )}
      </div>

      <div
        {...{ [ANNOTATION_UI_ATTR]: "" }}
        data-review-annotation-badges={items.length > 0 ? index : undefined}
        // Takes the focus when a delete leaves this passage with no control.
        tabIndex={-1}
        role="group"
        aria-label={`Review discussion for block ${index + 1}`}
        className={items.length > 0 ? "flow-root" : undefined}
      >
        {items.some((item) => !expanded.has(item.id)) && (
          <ul
            aria-label="Review comments on this passage"
            data-review-collapsed-badges
            className="relative z-10 mt-[5px] mb-0 flex list-none flex-wrap justify-end space-y-0 gap-x-2 gap-y-[18px] pr-2"
          >
            {items
              .filter((item) => !expanded.has(item.id))
              .map((item) => (
                <li
                  key={item.id}
                  className="flex max-w-full -translate-y-1/2 whitespace-normal"
                >
                  <AnnotationBadge item={item} />
                </li>
              ))}
          </ul>
        )}

        <div className="mr-2 [&>section:first-child]:mt-[5px]">
          {items
            .filter((item) => expanded.has(item.id))
            .map((item) =>
              item.type === "thread" ? (
                <ThreadCard
                  key={item.id}
                  thread={item.thread}
                  identity={<AnnotationBadge item={item} />}
                />
              ) : (
                <SuggestionCard
                  key={item.id}
                  suggestion={item.suggestion}
                  identity={<AnnotationBadge item={item} />}
                />
              )
            )}
        </div>

        {composing && <DraftCard draft={composing} onCancel={cancelDraft} />}
      </div>
    </div>
  );
};
