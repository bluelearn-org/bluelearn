import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { z } from "zod";
import {
  createDecisionSchema,
  paginationSchema,
  reviewCaseDetailResponseSchema,
  reviewCaseListResponseSchema,
  reviewDecisionResponseSchema,
  reviewQueueResponseSchema,
} from "@bluelearn/schemas";
import { errorResponses, jsonContent, validate } from "../lib/openapi";
import {
  getAuthenticatedUser,
  getServiceSupabase,
  requireUser,
} from "../middleware/auth.middleware";
import { rateLimitMiddleware } from "../middleware/rate-limit.middleware";
import { MODERATION } from "../middleware/rateLimits";
import type { HonoEnv } from "../types";
import {
  castDecision,
  getReviewCase,
  getReviewQueue,
  listReviewCases,
} from "../services/review.service";
import {
  scheduleSearchSync,
  syncGuideForReviewCase,
} from "../services/search.service";

const idParamSchema = z.object({ id: z.uuid() });

export const reviewsRouter = new Hono<HonoEnv>()
  // Open cases needing action from the current reviewer
  .get(
    "/queue",
    describeRoute({
      tags: ["reviews"],
      summary: "Open cases needing the caller's action",
      security: [{ bearerAuth: [] }],
      responses: {
        200: jsonContent(reviewQueueResponseSchema, "Open cases"),
        ...errorResponses(400, 401),
      },
    }),
    requireUser,
    validate("query", paginationSchema),
    async (c) => {
      const { page, limit } = c.req.valid("query");
      const { data, total } = await getReviewQueue(
        c.get("supabase"),
        c.get("user").id,
        { page, limit }
      );
      return c.json({ cases: data, total }, 200);
    }
  )

  // All finished review cases (public — only returns approved/rejected)
  .get(
    "/cases",
    describeRoute({
      tags: ["reviews"],
      summary: "List all / past cases",
      responses: {
        200: jsonContent(reviewCaseListResponseSchema, "Review cases"),
      },
    }),
    async (c) => {
      const cases = await listReviewCases(c.get("supabase"));
      return c.json({ cases }, 200);
    }
  )

  // Case detail with panel, members, decisions, and linked revision (public).
  // The proposed prerequisites, todos, and subjects come along once the case
  // closes or beforehand for the author and the seated panel.
  .get(
    "/cases/:id",
    describeRoute({
      tags: ["reviews"],
      summary: "Get a case with its panel and decisions",
      responses: {
        200: jsonContent(
          reviewCaseDetailResponseSchema,
          "Case + panel + decisions"
        ),
        ...errorResponses(403, 404),
      },
    }),
    validate("param", idParamSchema),
    async (c) => {
      const { user } = await getAuthenticatedUser(c);
      const result = await getReviewCase(
        c.get("supabase"),
        getServiceSupabase(c),
        c.req.valid("param").id,
        user?.id ?? null
      );
      return c.json(result, 200);
    }
  )

  // Cast a panel vote with written justification
  .post(
    "/cases/:id/decisions",
    describeRoute({
      tags: ["reviews"],
      summary: "Cast a panel vote",
      security: [{ bearerAuth: [] }],
      responses: {
        200: jsonContent(reviewDecisionResponseSchema, "The recorded decision"),
        ...errorResponses(400, 401, 404, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...MODERATION, bucket: "review-decision" }),
    validate("param", idParamSchema),
    validate("json", createDecisionSchema),
    async (c) => {
      const input = c.req.valid("json");
      const id = c.req.valid("param").id;
      const result = await castDecision(c.get("supabase"), id, input);
      // This vote may have published the revision — refresh the search index
      // for the guide behind this case (best-effort).
      scheduleSearchSync(
        c,
        syncGuideForReviewCase(c.env, c.get("supabase"), id)
      );
      return c.json({ decision: result }, 200);
    }
  );
