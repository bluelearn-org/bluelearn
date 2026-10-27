import { z } from "zod";

// Mirrors public.notification_category.
export const notificationCategorySchema = z.enum([
  "guide_statuses",
  "variant_statuses",
  "community_engagement",
  "review_workflows",
]);

// Mirrors the rows of public.notification_types.
export const notificationTypeSchema = z.enum([
  "guide_review_decision",
  "variant_created",
  "variant_review_decision",
  "variant_edited",
  "guide_upvotes",
  "guide_downvotes",
  "review_assignment",
  "review_deadline",
]);

export const notificationFilterSchema = z.enum(["all", "unread"]);

export type NotificationCategory = z.infer<typeof notificationCategorySchema>;
export type NotificationType = z.infer<typeof notificationTypeSchema>;
export type NotificationFilter = z.infer<typeof notificationFilterSchema>;
