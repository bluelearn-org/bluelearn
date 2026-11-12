import {
  CircleCheck,
  CircleX,
  ClipboardList,
  Clock,
  GitBranch,
  Pencil,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  Notification,
  NotificationCategory,
  NotificationType,
} from "@bluelearn/schemas";
import { downvoteReasonItems } from "@/lib/api/votes";

// Each type pairs a database registry entry and event source with a renderer.
// The bell hides types without a renderer, and settings disables their toggles.

export type NotificationTarget =
  | { to: "/review/$caseId"; params: { caseId: string } }
  | {
      to: "/guides/$slug/$variantSlug";
      params: { slug: string; variantSlug: string };
    }
  | { to: "/profile/notifications"; hash: string };

export type NotificationView = {
  title: string;
  body: string;
  // Shown under the body in the bell panel only, such as a pointer to the
  // notifications page.
  hint?: string;
  // Null when the data no longer names a page to open.
  target: NotificationTarget | null;
  // Where the notifications page opens the row, when target is that page.
  pageTarget?: NotificationTarget | null;
  // Shown in place of the avatar when nobody acted, such as a panel outcome.
  icon: LucideIcon;
  // Each downvote reason and note in the row, newest first, for the
  // notifications page.
  feedback?: Array<{ reason: string | null; note: string | null }>;
};

type Renderer = (notification: Notification) => NotificationView;

export const notificationRenderers: Partial<
  Record<NotificationType, Renderer>
> = {
  guide_review_decision: (notification) =>
    reviewDecision(notification, "guide"),
  variant_review_decision: (notification) =>
    reviewDecision(notification, "variant"),
  guide_upvotes: upvotes,

  // Downvoters stay private, so these rows never carry an actor. The bell
  // opens the notifications page, which shows the reasons and notes; there
  // the row opens the guide.
  guide_downvotes: ({ id, data, count }) => {
    const title = text(data.title) ?? "Untitled";
    const votes = voteTotal(data) ?? count;

    return {
      title: "Downvote",
      body:
        votes === 1
          ? `A downvote on "${title}"`
          : `${votes} downvotes on "${title}"`,
      hint: "Click to see why.",
      target: { to: "/profile/notifications", hash: notificationAnchor(id) },
      pageTarget: guideTarget(data),
      icon: ThumbsDown,
      feedback: downvoteFeedback(data),
    };
  },

  variant_created: ({ data, actor }) => ({
    title: "New variant",
    body: `${actorName(actor)} published a variant "${text(data.title) ?? "Untitled"}" of your guide`,
    target: guideTarget(data),
    icon: GitBranch,
  }),

  variant_edited: ({ data, actor }) => ({
    title: "Variant edited",
    body: `${actorName(actor)} edited your variant "${text(data.title) ?? "Untitled"}"`,
    target: guideTarget(data),
    icon: Pencil,
  }),

  review_assignment: ({ data }) => ({
    title: "Review assigned",
    body: `You have been assigned to review "${text(data.title) ?? "Untitled"}"`,
    target: reviewTarget(data),
    icon: ClipboardList,
  }),

  review_deadline: ({ data }) => {
    const title = text(data.title) ?? "Untitled";
    const expiresAt = text(data.expires_at);
    const expiry = expiresAt ? new Date(expiresAt) : null;

    const deadline =
      expiry && Number.isFinite(expiry.getTime())
        ? expiry.toLocaleString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZoneName: "short",
          })
        : null;

    return {
      title: "Review deadline approaching",
      body: deadline
        ? `Your review of "${title}" is due ${deadline}`
        : `The deadline for your review of "${title}" is approaching`,
      target: reviewTarget(data),
      icon: Clock,
    };
  },
};

export function renderNotification(notification: Notification) {
  return notificationRenderers[notification.type]?.(notification) ?? null;
}

export function isNotificationTypeLive(type: NotificationType) {
  return type in notificationRenderers;
}

// The id of a row on the notifications page, and the link hash that opens it.
export function notificationAnchor(id: string) {
  return `notification-${id}`;
}

function reviewDecision(
  { data }: Notification,
  kind: "guide" | "variant"
): NotificationView {
  const approved = data.outcome === "approved";
  const title = text(data.title) ?? "Untitled";
  const label = kind === "guide" ? "Guide" : "Variant";

  return {
    title: `${label} ${approved ? "approved" : "rejected"}`,
    body: approved
      ? `Your ${kind} "${title}" has been approved`
      : `Your ${kind} "${title}" was not approved`,
    target: reviewTarget(data),
    icon: approved ? CircleCheck : CircleX,
  };
}

function upvotes({ data, actor, count }: Notification): NotificationView {
  const title = text(data.title) ?? "your guide";
  const total = voteTotal(data);
  const who = actorName(actor);
  const others = count - 1;
  const otherVoters = others === 1 ? "1 other" : `${others} others`;

  return {
    title: "Upvote",
    body: total
      ? `${total} upvotes on "${title}"`
      : others === 0
        ? `${who} upvoted "${title}"`
        : `${who} and ${otherVoters} upvoted "${title}"`,
    target: guideTarget(data),
    icon: ThumbsUp,
  };
}

// A row after the live tier shows the guide's total instead of its own count.
function voteTotal(data: Notification["data"]) {
  return typeof data.total === "number" &&
    Number.isInteger(data.total) &&
    data.total > 0
    ? data.total
    : null;
}

// One { reason, note } entry per downvote, newest first. A reason the app
// does not know keeps its note.
function downvoteFeedback(data: Notification["data"]) {
  const entries = Array.isArray(data.feedback)
    ? data.feedback.filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === "object" && entry !== null
      )
    : [];

  return entries.flatMap((entry) => {
    const reason =
      downvoteReasonItems.find((item) => item.value === entry.reason)?.label ??
      null;
    const note = text(entry.note);

    return reason || note ? [{ reason, note }] : [];
  });
}

function actorName(actor: Notification["actor"]) {
  const username = text(actor?.username);

  return username ? `@${username}` : "Someone";
}

function guideTarget(data: Notification["data"]): NotificationTarget | null {
  const slug = text(data.base_slug);
  const variantSlug = text(data.variant_slug);

  return slug && variantSlug
    ? { to: "/guides/$slug/$variantSlug", params: { slug, variantSlug } }
    : null;
}

function reviewTarget(data: Notification["data"]): NotificationTarget | null {
  const caseId = text(data.case_id);

  return caseId ? { to: "/review/$caseId", params: { caseId } } : null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

// Settings page order and wording, from the design in issue #531.
export const notificationSections: Array<{
  category: NotificationCategory;
  label: string;
  types: Array<{ type: NotificationType; label: string }>;
}> = [
  {
    category: "guide_statuses",
    label: "Guide statuses",
    types: [
      { type: "guide_review_decision", label: "Guide review decision" },
      { type: "variant_created", label: "Variant created" },
    ],
  },
  {
    category: "variant_statuses",
    label: "Variant statuses",
    types: [
      { type: "variant_review_decision", label: "Variant review decision" },
      { type: "variant_edited", label: "Variant edited" },
    ],
  },
  {
    category: "community_engagement",
    label: "Community engagement",
    types: [
      { type: "guide_upvotes", label: "Upvotes" },
      { type: "guide_downvotes", label: "Downvotes" },
    ],
  },
  {
    category: "review_workflows",
    label: "Review workflows",
    types: [
      { type: "review_assignment", label: "Assignments" },
      { type: "review_deadline", label: "Deadlines approaching" },
    ],
  },
];
