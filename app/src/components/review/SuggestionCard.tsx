import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Check, ChevronUp, X } from "lucide-react";
import type { ReactNode } from "react";

import type { ReviewSuggestion } from "@/lib/api/reviewAnnotations";
import { GuideMarkdown } from "@/components/GuideReader";
import { DiffField } from "@/components/RevisionDiff";
import {
  ReviewerBadge,
  cardId,
  participantName,
} from "@/components/review/AnnotationParts";
import { useReviewAnnotations } from "@/components/review/ReviewAnnotations";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/guideUtils";

type Decision = "accepted" | "rejected";

type PropTypes = {
  suggestion: ReviewSuggestion;
  detached?: boolean;
  identity?: ReactNode;
};

const DecisionLine = ({ suggestion }: { suggestion: ReviewSuggestion }) => {
  if (suggestion.status === "pending")
    return (
      <p className="text-xs text-muted-foreground">
        Waiting for the author. The guide does not publish while this edit
        waits.
      </p>
    );

  const verb = suggestion.status === "accepted" ? "Accepted" : "Rejected";
  const when = suggestion.decided_at
    ? ` on ${formatDate(new Date(suggestion.decided_at))}`
    : "";

  return (
    <p className="text-xs text-muted-foreground">
      {verb} by {participantName(suggestion.decided_by)}
      {when}.
      {suggestion.status === "accepted" &&
        (suggestion.applied_revision_id
          ? " Published with the guide."
          : " It applies when the guide publishes.")}
    </p>
  );
};

export const SuggestionCard = ({
  suggestion,
  detached = false,
  identity,
}: PropTypes) => {
  const { permissions, decide, toggle } = useReviewAnnotations();
  const [confirming, setConfirming] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<HTMLElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const acceptButton = useRef<HTMLButtonElement>(null);
  const rejectButton = useRef<HTMLButtonElement>(null);

  const canDecide =
    permissions.can_decide_suggestions &&
    suggestion.status === "pending" &&
    suggestion.anchor_status === "current";

  // Each step removes the button that has focus. Focus moves to the control
  // that replaces it, or to the card after the decision saves.
  const ask = (decision: Decision) => {
    flushSync(() => setConfirming(decision));
    confirmRef.current?.focus({ preventScroll: true });
  };

  const cancel = () => {
    const asker = confirming === "accepted" ? acceptButton : rejectButton;
    flushSync(() => setConfirming(null));
    asker.current?.focus({ preventScroll: true });
  };

  const confirm = async (decision: Decision) => {
    setBusy(true);
    setError(null);

    try {
      await decide(suggestion.id, decision);
      setConfirming(null);
      cardRef.current?.focus({ preventScroll: true });
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : "Could not save your decision. Try again."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      ref={cardRef}
      tabIndex={-1}
      id={cardId(suggestion.id)}
      aria-label={`Suggested edit by ${participantName(suggestion.author)}`}
      className="my-3 space-y-3 rounded-lg border bg-card p-3 text-sm shadow-xs"
    >
      <header className="flex flex-col items-end gap-1 text-right text-xs">
        {identity ?? <ReviewerBadge participant={suggestion.author} />}
        <time
          dateTime={suggestion.created_at}
          className="mono-micro text-muted-foreground"
        >
          {formatDate(new Date(suggestion.created_at))}
        </time>
      </header>

      {suggestion.note && (
        <div className="text-sm [&_p]:mb-2 [&_p]:text-foreground [&_p:last-child]:mb-0">
          <GuideMarkdown markdown={suggestion.note} anchorHeadings={false} />
        </div>
      )}

      <div className="overflow-hidden rounded-md border text-left">
        <div className="space-y-px bg-border lg:hidden">
          <div className="diff-removed p-3">
            <p className="mb-2 text-xs font-semibold">Original</p>
            <pre className="font-sans text-sm break-words whitespace-pre-wrap">
              {suggestion.original || "(Empty block)"}
            </pre>
          </div>
          <div className="diff-added p-3">
            <p className="mb-2 text-xs font-semibold">Proposed</p>
            <pre className="font-sans text-sm break-words whitespace-pre-wrap">
              {suggestion.proposed || "(Remove this block)"}
            </pre>
          </div>
        </div>
        <div className="hidden lg:block">
          <DiffField label="Suggested edit" field={suggestion.diff} />
        </div>
      </div>

      <DecisionLine suggestion={suggestion} />

      {canDecide && !confirming && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            ref={rejectButton}
            type="button"
            variant="outline"
            size="lg"
            className="btn-reject"
            onClick={() => ask("rejected")}
          >
            <X aria-hidden />
            Reject edit
          </Button>
          <Button
            ref={acceptButton}
            type="button"
            variant="outline"
            size="lg"
            className="btn-approve"
            onClick={() => ask("accepted")}
          >
            <Check aria-hidden />
            Accept edit
          </Button>
        </div>
      )}

      {canDecide && confirming && (
        <div
          ref={confirmRef}
          tabIndex={-1}
          role="group"
          aria-label="Confirm your decision"
          className="space-y-2 rounded-md border border-dashed p-3"
        >
          <p className="text-xs">
            {confirming === "accepted"
              ? "Accept this edit? It goes into the guide when the guide publishes. You cannot change this decision."
              : "Reject this edit? It never goes into the guide. You cannot change this decision."}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="btn-sec"
              disabled={busy}
              onClick={cancel}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={confirming === "accepted" ? "default" : "destructive"}
              size="lg"
              className={confirming === "accepted" ? "btn-pri" : "btn-danger"}
              disabled={busy}
              onClick={() => confirm(confirming)}
            >
              {busy
                ? "Saving..."
                : confirming === "accepted"
                  ? "Confirm accept"
                  : "Confirm reject"}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      {!detached && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            onClick={() => toggle(suggestion.id)}
          >
            <ChevronUp aria-hidden />
            Collapse
          </Button>
        </div>
      )}
    </section>
  );
};
