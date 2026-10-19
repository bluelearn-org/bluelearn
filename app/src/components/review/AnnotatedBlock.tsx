import { useRef } from "react";
import { flushSync } from "react-dom";
import {
  ChevronDown,
  GripHorizontal,
  MessageSquare,
  MessageSquarePlus,
  PencilLine,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  ANNOTATION_UI_ATTR,
  BLOCK_CONTENT_ATTR,
  BLOCK_SOURCE_END_ATTR,
  BLOCK_SOURCE_START_ATTR,
  blockAnchor,
  sourceRangeFits,
} from "@/lib/reviewAnchors";
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
            {item.thread.replies.length + 1}
            <span className="sr-only">
              {item.thread.replies.length === 0 ? "comment" : "comments"}
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

const SelectionGrip = ({ edge }: { edge: "start" | "end" }) => {
  const { selectionControls } = useReviewAnnotations();
  return (
    <button
      type="button"
      aria-label={`Adjust selection ${edge}`}
      title="Drag to snap to a block. Use Up and Down arrows to adjust; Escape clears the selection."
      data-review-selection-grip={edge}
      {...{ [ANNOTATION_UI_ATTR]: "" }}
      className={cn(
        "absolute z-30 flex size-11 touch-none items-center justify-center rounded-full outline-none select-none focus-visible:ring-2 focus-visible:ring-ring",
        edge === "start" ? "-top-9 -left-2" : "-right-2 -bottom-9"
      )}
      onPointerDown={(event) => selectionControls.startDrag(edge, event)}
      onKeyDown={(event) => selectionControls.adjustWithKeyboard(edge, event)}
      onClick={(event) => event.stopPropagation()}
    >
      <span className="flex h-5 w-8 items-center justify-center rounded-full border border-background bg-brand-bright-blue text-white shadow-sm">
        <GripHorizontal aria-hidden className="size-4" />
      </span>
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
    openDraft,
    closeDraft,
    activeBlock,
    setActiveBlock,
  } = useReviewAnnotations();
  const actionsRef = useRef<HTMLDivElement>(null);

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
  const selected = selectedAnchor
    ? index >= selectedAnchor.start_block && index <= selectedAnchor.end_block
    : activeBlock === index;

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

  const open = (mode: "comment" | "suggestion") => {
    const anchor = rootRef.current && blockAnchor(rootRef.current, index);
    if (anchor) openDraft({ mode, anchor });
  };

  // Focus goes back to the passage the reader left, not to the page top.
  const cancelDraft = () => {
    const origin = composing?.anchor.end_block ?? index;
    flushSync(() => {
      closeDraft();
      setActiveBlock(origin);
    });
    const actions =
      origin === index
        ? actionsRef.current
        : rootRef.current?.querySelector(
            `[data-review-block="${origin}"] [data-review-block-actions]`
          );
    actions?.querySelector("button")?.focus({ preventScroll: true });
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
          style={{ viewTransitionName: `review-source-${index}` }}
          className={cn(
            "[view-transition-class:review-motion]",
            marked && "px-3 [&>:first-child]:mt-0 [&>:last-child]:mb-0",
            marked && (first ? "pt-3" : "pt-2"),
            marked && (last ? "pb-3" : "pb-2")
          )}
        >
          {children}
        </div>
        {blockSelection && !draft && permissions.can_comment && (
          <>
            {selection?.start_block === index && <SelectionGrip edge="start" />}
            {selection?.end_block === index && <SelectionGrip edge="end" />}
          </>
        )}
      </div>

      <div
        {...{ [ANNOTATION_UI_ATTR]: "" }}
        data-review-annotation-badges={items.length > 0 ? index : undefined}
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

        {hasActions && !composing && (
          <div
            ref={actionsRef}
            data-review-block-actions
            className={cn(
              "absolute inset-x-0 top-full z-40 flex flex-wrap gap-2 rounded-lg border bg-background p-2 shadow-md",
              activeBlock !== index &&
                "pointer-events-none opacity-0 focus-within:pointer-events-auto focus-within:opacity-100"
            )}
          >
            {permissions.can_comment && (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => selectBlocks(index, index)}
              >
                <GripHorizontal aria-hidden />
                Select block
              </Button>
            )}
            {permissions.can_comment && (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => open("comment")}
              >
                <MessageSquarePlus aria-hidden />
                Comment on block
              </Button>
            )}
            {canSuggest && (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => open("suggestion")}
              >
                <PencilLine aria-hidden />
                Suggest edit
              </Button>
            )}
          </div>
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
