import { z } from "zod";
import { notificationCategorySchema, notificationTypeSchema } from "./enums";

export const notificationActorSchema = z.object({
  id: z.uuid(),
  username: z.string(),
});

export const notificationSchema = z.object({
  id: z.uuid(),
  type: notificationTypeSchema,
  category: notificationCategorySchema,
  // Null for system events, such as a panel outcome.
  actor: notificationActorSchema.nullable(),
  // How many events the row groups, for example 5 upvotes on one guide.
  count: z.number().int().min(1),
  // Each type sets its own fields. The app reads them in its renderer.
  data: z.record(z.string(), z.unknown()),
  occurred_at: z.iso.datetime({ offset: true }),
  read_at: z.iso.datetime({ offset: true }).nullable(),
});

export const notificationsResponseSchema = z.strictObject({
  notifications: z.array(notificationSchema),
  has_more: z.boolean(),
});

export const unreadNotificationCountResponseSchema = z.strictObject({
  count: z.number().int().min(0),
});

export const notificationPreferenceSchema = z.object({
  type: notificationTypeSchema,
  category: notificationCategorySchema,
  enabled: z.boolean(),
});

export const notificationPreferencesResponseSchema = z.strictObject({
  preferences: z.array(notificationPreferenceSchema),
});

export type NotificationActor = z.infer<typeof notificationActorSchema>;
export type Notification = z.infer<typeof notificationSchema>;
export type NotificationsResponse = z.infer<typeof notificationsResponseSchema>;
export type NotificationPreference = z.infer<
  typeof notificationPreferenceSchema
>;
