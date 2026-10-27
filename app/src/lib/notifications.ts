import { CircleCheck, CircleX, ThumbsUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  Notification,
  NotificationCategory,
  NotificationType,
} from "@bluelearn/schemas";

// The app half of a notification type. The database half is a row in
// public.notification_types and a public.notify() call. A type without a
// renderer is not sent yet: the bell skips it and its setting is disabled.

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
  guide_review_decision: ({ data }) => {
    const approved = data.outcome === "approved";
    const guideTitle = text(data.title) ?? "Untitled";
    const caseId = text(data.case_id);

    return {
      title: approved ? "Guide approved" : "Guide rejected",
      body: approved
        ? `Your guide "${guideTitle}" has been approved`
        : `Your guide "${guideTitle}" was not approved`,
      target: caseId ? { to: "/review/$caseId", params: { caseId } } : null,
      icon: approved ? CircleCheck : CircleX,
    };
  },

  guide_upvotes: ({ data, actor, count }) => {
    const guideTitle = text(data.title) ?? "your guide";
    const slug = text(data.base_slug);
    const variantSlug = text(data.variant_slug);
    const who = actor ? `@${actor.username}` : "Someone";
    const others = count - 1;
    const otherVoters = others === 1 ? "1 other" : `${others} others`;

    return {
      title: count === 1 ? "New upvote" : `${count} new upvotes`,
      body:
        others === 0
          ? `${who} upvoted "${guideTitle}"`
          : `${who} and ${otherVoters} upvoted "${guideTitle}"`,
      target:
        slug && variantSlug
          ? {
              to: "/guides/$slug/$variantSlug",
              params: { slug, variantSlug },
            }
          : null,
      icon: ThumbsUp,
    };
  },
};

export function renderNotification(notification: Notification) {
  return notificationRenderers[notification.type]?.(notification) ?? null;
}

export function isNotificationTypeLive(type: NotificationType) {
  return type in notificationRenderers;
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

function text(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}
