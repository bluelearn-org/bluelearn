import { Suspense, lazy, useEffect, useRef, useState } from "react";

import {
  REVIEW_COMMENT_MAX_LENGTH,
  REVIEW_PROPOSED_MAX_LENGTH,
} from "@bluelearn/schemas";
import type { Draft } from "@/components/review/ReviewAnnotations";
import { PassageQuote } from "@/components/review/AnnotationParts";
import { CommentComposer } from "@/components/review/CommentComposer";
import {
  draftKey,
  useReviewAnnotations,
} from "@/components/review/ReviewAnnotations";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// Suggested edits need the guide editor's math and callout support.
const Editor = lazy(() => import("@/components/contribute/editor/Editor"));

type PropTypes = {
  draft: Draft;
  onCancel: () => void;
};

const SuggestionDraft = ({ draft, onCancel }: PropTypes) => {
  const { drafts, revisionBody, createSuggestion } = useReviewAnnotations();
  const key = draftKey(draft);
  const original = revisionBody.slice(
    draft.anchor.source_start ?? 0,
    draft.anchor.source_end ?? 0
  );

  const [initialProposed] = useState(
    () => drafts.get(`${key}:proposed`) ?? original
  );
  const proposedRef = useRef(initialProposed);
  const [note, setNote] = useState(() => drafts.get(`${key}:note`) ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  // The button that opened the draft is gone, and the editor loads later.
  // The draft holds the focus so it does not fall to the page body.
  useEffect(() => {
    sectionRef.current?.focus({ preventScroll: true });
  }, []);

  const submit = async () => {
    // The editor ends its markdown with a line break the block never had.
    const proposed = proposedRef.current.replace(/\n+$/, "");

    if (proposed === original) {
      setError("Change the text before you submit the edit.");
      return;
    }
    if (proposed.length > REVIEW_PROPOSED_MAX_LENGTH) {
      setError(
        `Use ${REVIEW_PROPOSED_MAX_LENGTH} characters or fewer in the edit.`
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await createSuggestion(draft.anchor, proposed, note);
      drafts.delete(`${key}:proposed`);
      drafts.delete(`${key}:note`);
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : "Could not save your edit. Try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      ref={sectionRef}
      tabIndex={-1}
      aria-label="Suggest an edit"
      className="my-3 space-y-3 rounded-lg border border-brand-bright-blue/40 bg-card p-3 text-sm shadow-xs"
    >
      <p className="text-xs text-muted-foreground">
        Edit this block. The author accepts or rejects your edit before the
        guide publishes.
      </p>

      <Suspense
        fallback={
          <p className="mono-micro text-muted-foreground">Loading editor...</p>
        }
      >
        <Editor
          value={initialProposed}
          changeDelayMs={0}
          onChange={(markdown) => {
            proposedRef.current = markdown;
            drafts.set(`${key}:proposed`, markdown);
          }}
        />
      </Suspense>

      <label className="block space-y-1 text-xs">
        <span className="font-medium">Reason for the edit (optional)</span>
        <Textarea
          value={note}
          maxLength={REVIEW_COMMENT_MAX_LENGTH}
          rows={3}
          onChange={(event) => {
            setNote(event.target.value);
            drafts.set(`${key}:note`, event.target.value);
          }}
        />
      </label>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={submitting}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="min-h-11"
          disabled={submitting}
          onClick={submit}
        >
          {submitting ? "Saving..." : "Submit edit"}
        </Button>
      </div>
    </section>
  );
};

export const DraftCard = ({ draft, onCancel }: PropTypes) => {
  const { drafts, createThread } = useReviewAnnotations();
  const key = draftKey(draft);

  if (draft.mode === "suggestion")
    return <SuggestionDraft draft={draft} onCancel={onCancel} />;

  return (
    <section
      aria-label="New comment"
      className="my-3 space-y-3 rounded-lg border border-brand-bright-blue/40 bg-card p-3 text-sm shadow-xs"
    >
      <PassageQuote anchor={draft.anchor} />
      <CommentComposer
        label="Comment"
        submitLabel="Post comment"
        maxLength={REVIEW_COMMENT_MAX_LENGTH}
        autoFocus
        initialValue={drafts.get(key) ?? ""}
        onDraftChange={(markdown) => drafts.set(key, markdown)}
        onSubmit={(markdown) => createThread(draft.anchor, markdown)}
        onCancel={onCancel}
      />
    </section>
  );
};
