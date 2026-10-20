import { PenLine, Quote, ShieldCheck, UserX } from "lucide-react";
import type { ReactNode, Ref } from "react";

import type { ReviewParticipant } from "@/lib/api/reviewAnnotations";
import type { PassageAnchor } from "@/lib/reviewAnchors";
import { GuideMarkdown } from "@/components/GuideReader";
import { formatDate } from "@/lib/guideUtils";

export const cardId = (itemId: string) => `review-card-${itemId}`;
export const badgeId = (itemId: string) => `review-badge-${itemId}`;

export function participantName(participant: ReviewParticipant | null) {
  if (!participant) return "Deleted user";
  return participant.display_name ?? `@${participant.username}`;
}

const ROLE_LABELS: Record<ReviewParticipant["role"], string> = {
  panelist: "Verifier",
  author: "Author",
};

export const ReviewerBadge = ({
  participant,
}: {
  participant: ReviewParticipant | null;
}) => {
  const Icon = !participant
    ? UserX
    : participant.role === "author"
      ? PenLine
      : ShieldCheck;

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Icon aria-hidden className="size-4 shrink-0 text-brand-bright-blue" />
      <span className="truncate font-medium text-foreground">
        {participantName(participant)}
      </span>
      {participant && (
        <span className="mono-micro shrink-0 text-muted-foreground">
          {ROLE_LABELS[participant.role]}
        </span>
      )}
    </span>
  );
};

export const PassageQuote = ({ anchor }: { anchor: PassageAnchor }) => {
  const truncated =
    anchor.kind === "block" && anchor.quote.length < anchor.end_offset;

  return (
    <figure className="flex gap-2 rounded-md bg-muted/60 px-3 py-2 text-xs">
      <Quote
        aria-hidden
        className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
      />
      <blockquote className="line-clamp-4 border-0 p-0 break-words whitespace-pre-wrap text-foreground">
        {anchor.quote === ""
          ? "A block without text, such as an image."
          : `${anchor.quote}${truncated ? "..." : ""}`}
      </blockquote>
    </figure>
  );
};

export const CommentEntry = ({
  ref,
  author,
  body,
  createdAt,
  edited,
  deleted,
  identity,
  actions,
}: {
  ref?: Ref<HTMLElement>;
  author: ReviewParticipant | null;
  body: string;
  createdAt: string;
  edited: boolean;
  deleted: boolean;
  identity?: ReactNode;
  actions?: ReactNode;
}) => (
  <article
    ref={ref}
    tabIndex={-1}
    className="flex items-start gap-3 rounded-md border border-brand-bright-blue/15 bg-brand-bright-blue/5 px-3 py-2"
  >
    {deleted ? (
      <p className="mb-0 min-w-0 flex-1 text-sm text-muted-foreground italic">
        Comment deleted
      </p>
    ) : (
      <div className="min-w-0 flex-1 text-sm [&_p]:mb-2 [&_p]:text-foreground [&_p:last-child]:mb-0">
        <GuideMarkdown markdown={body} anchorHeadings={false} />
      </div>
    )}
    <header className="flex max-w-[50%] min-w-0 shrink-0 flex-col items-end gap-0.5 text-right text-xs [&_.mono-micro]:sr-only [&>span]:max-w-full">
      {identity ?? <ReviewerBadge participant={author} />}
      <time
        dateTime={createdAt}
        className="text-[10px] leading-tight font-normal text-muted-foreground"
      >
        {formatDate(new Date(createdAt))}
      </time>
      {edited && !deleted && (
        <span className="text-[10px] leading-tight font-normal text-muted-foreground">
          Edited
        </span>
      )}
    </header>
    {actions}
  </article>
);
