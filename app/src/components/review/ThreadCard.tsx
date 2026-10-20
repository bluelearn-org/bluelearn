import { useLayoutEffect, useRef, useState } from "react";
import { ChevronUp, Ellipsis, Pencil, Trash2 } from "lucide-react";
import { REVIEW_COMMENT_MAX_LENGTH } from "@bluelearn/schemas";
import type { ReactNode, RefObject } from "react";

import type { ReviewReply, ReviewThread } from "@/lib/api/reviewAnnotations";
import {
  CommentEntry,
  PassageQuote,
  cardId,
  participantName,
} from "@/components/review/AnnotationParts";
import { CommentComposer } from "@/components/review/CommentComposer";
import {
  editDraftKey,
  replyDraftKey,
  useReviewAnnotations,
} from "@/components/review/ReviewAnnotations";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSuspensionStatus } from "@/lib/authContext";
import { ANNOTATION_UI_ATTR } from "@/lib/reviewAnchors";

type PropTypes = {
  thread: ReviewThread;
  // A thread whose passage is gone has no place in the text to collapse to.
  detached?: boolean;
  identity?: ReactNode;
};

type Step = "view" | "edit" | "delete";

type MessageProps = {
  threadId: string;
  message: ReviewThread | ReviewReply;
  identity?: ReactNode;
};

const ThreadMessage = ({ threadId, message, identity }: MessageProps) => {
  const { drafts, editMessage, deleteMessage } = useReviewAnnotations();
  const suspensionStatus = useSuspensionStatus();
  const [step, setStep] = useState<Step>("view");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entryRef = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const focusAfterStep = useRef<RefObject<HTMLElement | null>>(null);

  const target = {
    threadId,
    replyId: message.id === threadId ? null : message.id,
  };
  const noun = target.replyId === null ? "comment" : "reply";
  const key = editDraftKey(message.id);
  const deleted = message.deleted_at !== null;

  // Case closure and seat expiry do not revoke message ownership.
  const manageable = suspensionStatus === "active" && !deleted;
  const canEdit = manageable && message.can_edit;
  const canDelete = manageable && message.can_delete;

  // Restore focus after the previous step's control leaves the DOM.
  useLayoutEffect(() => {
    const focusTarget = focusAfterStep.current;
    focusAfterStep.current = null;

    focusTarget?.current?.focus({ preventScroll: true });
  }, [step]);

  const changeStep = (
    next: Step,
    focusTarget: RefObject<HTMLElement | null> | null
  ) => {
    focusAfterStep.current = focusTarget;
    setStep(next);
  };

  const cancelEdit = () => {
    drafts.delete(key);
    changeStep("view", menuButton);
  };

  const cancelDelete = () => {
    setError(null);
    changeStep("view", menuButton);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setError(null);

    try {
      await deleteMessage(target);
      changeStep("view", entryRef);
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : `Could not delete your ${noun}. Try again.`
      );
    } finally {
      setDeleting(false);
    }
  };

  if (step === "edit")
    return (
      <CommentComposer
        label={`Edit ${noun}`}
        submitLabel="Save"
        maxLength={REVIEW_COMMENT_MAX_LENGTH}
        initialValue={drafts.get(key) ?? message.body}
        onDraftChange={(markdown) => drafts.set(key, markdown)}
        onCancel={cancelEdit}
        autoFocus
        onSubmit={async (markdown) => {
          await editMessage(target, markdown);
          changeStep("view", menuButton);
        }}
      />
    );

  const menu = step === "view" && (canEdit || canDelete) && (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          ref={menuButton}
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Actions for this ${noun}`}
          className="-my-2 -mr-2 size-11"
        >
          <Ellipsis aria-hidden />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        {...{ [ANNOTATION_UI_ATTR]: "" }}
        align="end"
        className="w-48 font-mono"
      >
        {canEdit && (
          <DropdownMenuItem
            className="min-h-11 cursor-pointer text-xs"
            onSelect={() => changeStep("edit", null)}
          >
            <Pencil aria-hidden />
            Edit {noun}
          </DropdownMenuItem>
        )}
        {canDelete && (
          <DropdownMenuItem
            variant="destructive"
            className="min-h-11 cursor-pointer text-xs"
            onSelect={() => changeStep("delete", confirmRef)}
          >
            <Trash2 aria-hidden />
            Delete {noun}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      <CommentEntry
        ref={entryRef}
        author={message.author}
        body={message.body}
        createdAt={message.created_at}
        edited={message.edited_at !== null}
        deleted={deleted}
        identity={identity}
        actions={menu}
      />

      {step === "delete" && (
        <div
          ref={confirmRef}
          tabIndex={-1}
          role="group"
          aria-label={`Confirm deleting this ${noun}`}
          className="mt-2 space-y-2 rounded-md border border-dashed p-3"
        >
          <p className="text-xs">
            {target.replyId === null
              ? "Delete this comment? Its text is removed, but its replies stay. You cannot undo this."
              : "Delete this reply? Its text is removed. You cannot undo this."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              className="min-h-11"
              disabled={deleting}
              onClick={confirmDelete}
            >
              {deleting ? "Deleting..." : `Delete ${noun}`}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={deleting}
              onClick={cancelDelete}
            >
              Cancel
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
      )}
    </>
  );
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
        {[thread, ...thread.replies].map((message) => (
          <li key={message.id} className="whitespace-normal">
            <ThreadMessage
              threadId={thread.id}
              message={message}
              identity={message.id === thread.id ? identity : undefined}
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
