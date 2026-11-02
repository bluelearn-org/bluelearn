import { z } from "zod";
import { paginationSchema } from "../pagination";
import {
  notificationCategorySchema,
  notificationFilterSchema,
  notificationTypeSchema,
} from "./enums";

export const notificationsQuerySchema = paginationSchema.extend({
  filter: notificationFilterSchema.default("all"),
  category: notificationCategorySchema.optional(),
});

export const notificationIdParamSchema = z.object({
  id: z.uuid(),
});

// Without a category, every unread notification is marked read.
export const markAllNotificationsReadSchema = z.object({
  category: notificationCategorySchema.optional(),
});

export const notificationTypeParamSchema = z.object({
  type: notificationTypeSchema,
});

export const updateNotificationPreferenceSchema = z.object({
  enabled: z.boolean(),
});

export type NotificationsQuery = z.infer<typeof notificationsQuerySchema>;
export type MarkAllNotificationsRead = z.infer<
  typeof markAllNotificationsReadSchema
>;
