import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import type { HonoEnv } from "../types";
import { requireUser } from "../middleware/auth.middleware";
import { rateLimitMiddleware } from "../middleware/rate-limit.middleware";
import { CONTRIBUTION } from "../middleware/rateLimits";
import {
  countUnreadNotifications,
  listNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  setNotificationPreference,
} from "../services/notification.service";
import { jsonContent, errorResponses, validate } from "../lib/openapi";
import {
  markAllNotificationsReadSchema,
  notificationIdParamSchema,
  notificationPreferencesResponseSchema,
  notificationsQuerySchema,
  notificationsResponseSchema,
  notificationTypeParamSchema,
  successResponseSchema,
  unreadNotificationCountResponseSchema,
  updateNotificationPreferenceSchema,
} from "@bluelearn/schemas";

export const notificationsRouter = new Hono<HonoEnv>()
  .get(
    "/",
    describeRoute({
      tags: ["notifications"],
      summary: "List your notifications, newest first",
      responses: {
        200: jsonContent(notificationsResponseSchema, "One page"),
        ...errorResponses(400, 401),
      },
    }),
    requireUser,
    validate("query", notificationsQuerySchema),
    async (c) => {
      const page = await listNotifications(
        c.get("supabase"),
        c.get("user").id,
        c.req.valid("query")
      );
      return c.json(page, 200);
    }
  )

  .get(
    "/unread-count",
    describeRoute({
      tags: ["notifications"],
      summary: "Count your unread notifications",
      responses: {
        200: jsonContent(unreadNotificationCountResponseSchema, "Count"),
        ...errorResponses(401),
      },
    }),
    requireUser,
    async (c) => {
      const count = await countUnreadNotifications(
        c.get("supabase"),
        c.get("user").id
      );
      return c.json({ count }, 200);
    }
  )

  .post(
    "/read-all",
    describeRoute({
      tags: ["notifications"],
      summary: "Mark your unread notifications read",
      responses: {
        200: jsonContent(successResponseSchema, "Marked read"),
        ...errorResponses(400, 401),
      },
    }),
    requireUser,
    validate("json", markAllNotificationsReadSchema),
    async (c) => {
      await markAllNotificationsRead(
        c.get("supabase"),
        c.get("user").id,
        c.req.valid("json")
      );
      return c.json({ success: true }, 200);
    }
  )

  .post(
    "/:id/read",
    describeRoute({
      tags: ["notifications"],
      summary: "Mark one notification read",
      responses: {
        200: jsonContent(successResponseSchema, "Marked read"),
        ...errorResponses(400, 401, 404),
      },
    }),
    requireUser,
    validate("param", notificationIdParamSchema),
    async (c) => {
      await markNotificationRead(
        c.get("supabase"),
        c.get("user").id,
        c.req.valid("param").id
      );
      return c.json({ success: true }, 200);
    }
  )

  .get(
    "/preferences",
    describeRoute({
      tags: ["notifications"],
      summary: "List your notification preferences",
      responses: {
        200: jsonContent(
          notificationPreferencesResponseSchema,
          "One entry per notification type"
        ),
        ...errorResponses(401),
      },
    }),
    requireUser,
    async (c) => {
      const preferences = await listNotificationPreferences(
        c.get("supabase"),
        c.get("user").id
      );
      return c.json({ preferences }, 200);
    }
  )

  .put(
    "/preferences/:type",
    describeRoute({
      tags: ["notifications"],
      summary: "Turn one notification type on or off",
      responses: {
        200: jsonContent(successResponseSchema, "Saved"),
        ...errorResponses(400, 401, 404),
      },
    }),
    requireUser,
    rateLimitMiddleware({
      ...CONTRIBUTION,
      bucket: "notification-preferences",
    }),
    validate("param", notificationTypeParamSchema),
    validate("json", updateNotificationPreferenceSchema),
    async (c) => {
      await setNotificationPreference(
        c.get("supabase"),
        c.get("user").id,
        c.req.valid("param").type,
        c.req.valid("json").enabled
      );
      return c.json({ success: true }, 200);
    }
  );
