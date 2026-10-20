import { RotateCw } from "lucide-react";
import type { ReactNode } from "react";

import { useReviewAnnotations } from "@/components/review/ReviewAnnotations";
import { SuggestionCard } from "@/components/review/SuggestionCard";
import { SelectionCommentAction } from "@/components/review/SelectionCommentAction";
import { SelectionOutline } from "@/components/review/SelectionOutline";
import { ThreadCard } from "@/components/review/ThreadCard";
import { Button } from "@/components/ui/button";

const AnnotationStatus = () => {
  const { status, error, reload, itemCount, permissions } =
    useReviewAnnotations();

  if (status === "error")
    return (
      <div
        role="alert"
        className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/40 px-3 py-2 text-xs"
      >
        <p className="text-destructive">
          {error ?? "Could not load review comments."}
        </p>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={reload}
        >
          <RotateCw aria-hidden />
          Retry
        </Button>
      </div>
    );

  if (status === "loading")
    return (
      <p role="status" className="mono-micro mb-6 text-muted-foreground">
        Loading review comments...
      </p>
    );

  if (itemCount > 0) return null;

  return (
    <p role="status" className="mb-6 text-xs text-muted-foreground">
      {permissions.can_comment
        ? "No comments yet. Select text to comment on it, or tap a block to comment on the whole block."
        : "No reviewer comments on this revision yet."}
    </p>
  );
};

// Comments whose passage this revision no longer shows. They keep their
// quote and stay out of the text instead of attaching to other words.
const DetachedAnnotations = () => {
  const { detached } = useReviewAnnotations();

  if (detached.length === 0) return null;

  return (
    <section
      aria-labelledby="review-detached-heading"
      className="markdown mt-10 border-t pt-6"
    >
      <h2
        id="review-detached-heading"
        className="mono-micro mt-0 mb-2 text-muted-foreground"
      >
        Comments on changed text
      </h2>
      <p className="mb-4 text-xs">
        The text these comments quote is not in this revision, so they are not
        shown in the guide.
      </p>
      {detached.map((item) =>
        item.type === "thread" ? (
          <ThreadCard key={item.id} thread={item.thread} detached />
        ) : (
          <SuggestionCard key={item.id} suggestion={item.suggestion} detached />
        )
      )}
    </section>
  );
};

export const AnnotatedGuide = ({ children }: { children: ReactNode }) => {
  const { rootRef } = useReviewAnnotations();

  return (
    <>
      <AnnotationStatus />
      <div ref={rootRef} className="relative">
        {children}
        <SelectionOutline />
      </div>
      <DetachedAnnotations />
      <SelectionCommentAction />
    </>
  );
};
