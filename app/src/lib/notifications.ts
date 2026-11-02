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

// Each type pairs a database registry entry and event source with a renderer.
// The bell hides types without a renderer, and settings disables their toggles.

export type NotificationTarget =
  | { to: "/review/$caseId"; params: { caseId: string } }
  | {
      to: "/guides/$slug/$variantSlug";
      params: { slug: string; variantSlug: string };
    };

export type NotificationView = {
  title: string;
  body: string;
  // Null when the data no longer names a page to open.
  target: NotificationTarget | null;
  // Shown in place of the avatar when nobody acted, such as a panel outcome.
  icon: LucideIcon;
};

type Renderer = (notification: Notification) => NotificationView;

export const notificationRenderers: Partial<
  Record<NotificationType, Renderer>
> = {
  guide_review_decision: (notification) =>
    reviewDecision(notification, "guide"),
  variant_review_decision: (notification) =>
    reviewDecision(notification, "variant"),
  guide_upvotes: (notification) => votes(notification, "up"),
  guide_downvotes: (notification) => votes(notification, "down"),

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

function votes(
  { data, actor, count }: Notification,
  direction: "up" | "down"
): NotificationView {
  const title = text(data.title) ?? "your guide";
  const who = actorName(actor);
  const others = count - 1;
  const otherVoters = others === 1 ? "1 other" : `${others} others`;
  const verb = `${direction}voted`;

  return {
    title:
      count === 1 ? `New ${direction}vote` : `${count} new ${direction}votes`,
    body:
      others === 0
        ? `${who} ${verb} "${title}"`
        : `${who} and ${otherVoters} ${verb} "${title}"`,
    target: guideTarget(data),
    icon: direction === "up" ? ThumbsUp : ThumbsDown,
  };
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
