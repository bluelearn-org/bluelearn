import { useRef, useState } from "react";
import { ChevronUp } from "lucide-react";
import { REVIEW_COMMENT_MAX_LENGTH } from "@bluelearn/schemas";
import type { ReactNode } from "react";

import type { ReviewThread } from "@/lib/api/reviewAnnotations";
import {
  CommentEntry,
  PassageQuote,
  cardId,
  participantName,
} from "@/components/review/AnnotationParts";
import { CommentComposer } from "@/components/review/CommentComposer";
import {
  replyDraftKey,
  useReviewAnnotations,
} from "@/components/review/ReviewAnnotations";
import { Button } from "@/components/ui/button";

type PropTypes = {
  thread: ReviewThread;
  // A thread whose passage is gone has no place in the text to collapse to.
  detached?: boolean;
  identity?: ReactNode;
};

export const ThreadCard = ({
  thread,
  detached = false,
  identity,
}: PropTypes) => {
  const { permissions, drafts, reply, toggle } = useReviewAnnotations();
  const key = replyDraftKey(thread.id);
  const [replying, setReplying] = useState(false);
  const replyButton = useRef<HTMLButtonElement>(null);
  const closeReply = () => {
    setReplying(false);
    replyButton.current?.focus({ preventScroll: true });
  };

  return (
    <section
      id={cardId(thread.id)}
      aria-label={`Comment thread by ${participantName(thread.author)}`}
      className="my-3 space-y-3 rounded-lg border bg-card p-3 text-sm shadow-xs"
    >
      {detached && <PassageQuote anchor={thread.anchor} />}

      <ol className="list-none space-y-3 pl-0">
        {[
          {
            id: thread.id,
            author: thread.author,
            body: thread.body,
            created_at: thread.created_at,
          },
          ...thread.replies,
        ].map((comment) => (
          <li key={comment.id} className="whitespace-normal">
            <CommentEntry
              author={comment.author}
              body={comment.body}
              createdAt={comment.created_at}
              identity={comment.id === thread.id ? identity : undefined}
            />
          </li>
        ))}
      </ol>

      {permissions.can_reply && replying && (
        <div id={`${cardId(thread.id)}-reply`}>
          <CommentComposer
            key={thread.replies.length}
            label="Reply"
            submitLabel="Post reply"
            maxLength={REVIEW_COMMENT_MAX_LENGTH}
            initialValue={drafts.get(key) ?? ""}
            onDraftChange={(markdown) => drafts.set(key, markdown)}
            onCancel={closeReply}
            autoFocus
            onSubmit={async (markdown) => {
              await reply(thread.id, markdown);
              closeReply();
            }}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        {permissions.can_reply && (
          <Button
            ref={replyButton}
            type="button"
            variant="ghost"
            className="min-h-11"
            aria-expanded={replying}
            aria-controls={replying ? `${cardId(thread.id)}-reply` : undefined}
            onClick={() => setReplying((open) => !open)}
          >
            {replying ? "Hide reply" : "Reply"}
          </Button>
        )}
        {!detached && (
          <Button
            type="button"
            variant="ghost"
            className="ml-auto min-h-11"
            onClick={() => toggle(thread.id)}
          >
            <ChevronUp aria-hidden />
            Collapse
          </Button>
        )}
      </div>
    </section>
  );
};
