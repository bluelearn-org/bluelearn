import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { z } from "zod";
import {
  createDecisionSchema,
  createReviewReplySchema,
  createReviewSuggestionSchema,
  createReviewThreadSchema,
  decideReviewSuggestionSchema,
  paginationSchema,
  reviewAnnotationsResponseSchema,
  reviewCaseDetailResponseSchema,
  reviewCaseListResponseSchema,
  reviewDecisionResponseSchema,
  reviewQueueResponseSchema,
  reviewSuggestionDecisionResponseSchema,
  reviewSuggestionResponseSchema,
  reviewThreadReplyResponseSchema,
  reviewThreadResponseSchema,
  updateReviewCommentSchema,
} from "@bluelearn/schemas";
import { errorResponses, jsonContent, validate } from "../lib/openapi";
import {
  getAuthenticatedUser,
  getServiceSupabase,
  requireUser,
} from "../middleware/auth.middleware";
import { rateLimitMiddleware } from "../middleware/rate-limit.middleware";
import { CONTRIBUTION, MODERATION } from "../middleware/rateLimits";
import type { HonoEnv } from "../types";
import {
  castDecision,
  getReviewCase,
  getReviewQueue,
  listReviewCases,
} from "../services/review.service";
import {
  createReviewSuggestion,
  createReviewThread,
  decideReviewSuggestion,
  deleteReviewReply,
  deleteReviewThread,
  editReviewReply,
  editReviewThread,
  getReviewAnnotations,
  replyToReviewThread,
} from "../services/review-annotation.service";
import {
  scheduleSearchSync,
  syncGuideForReviewCase,
} from "../services/search.service";

const idParamSchema = z.object({ id: z.uuid() });
const threadParamSchema = z.object({ id: z.uuid(), threadId: z.uuid() });
const replyParamSchema = z.object({
  id: z.uuid(),
  threadId: z.uuid(),
  replyId: z.uuid(),
});
const suggestionParamSchema = z.object({
  id: z.uuid(),
  suggestionId: z.uuid(),
});

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
        getServiceSupabase(c),
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
  )

  // Comment threads and suggested edits on the case revision, with what the
  // caller may do. Same visibility as the case itself.
  .get(
    "/cases/:id/annotations",
    describeRoute({
      tags: ["reviews"],
      summary: "List comment threads and suggested edits",
      responses: {
        200: jsonContent(
          reviewAnnotationsResponseSchema,
          "Threads, suggestions, permissions, and the publication gate"
        ),
        ...errorResponses(400, 403, 404),
      },
    }),
    validate("param", idParamSchema),
    async (c) => {
      const { user } = await getAuthenticatedUser(c);
      const result = await getReviewAnnotations(
        getServiceSupabase(c),
        c.req.valid("param").id,
        user?.id ?? null
      );

      return c.json(result, 200);
    }
  )

  // A panelist with a live seat comments on a passage or a whole block.
  .post(
    "/cases/:id/threads",
    describeRoute({
      tags: ["reviews"],
      summary: "Comment on a passage",
      security: [{ bearerAuth: [] }],
      responses: {
        201: jsonContent(reviewThreadResponseSchema, "The new thread"),
        ...errorResponses(400, 401, 403, 404, 409, 422, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...CONTRIBUTION, bucket: "review-feedback" }),
    validate("param", idParamSchema),
    validate("json", createReviewThreadSchema),
    async (c) => {
      const thread = await createReviewThread(
        c.get("supabase"),
        getServiceSupabase(c),
        c.get("user").id,
        c.req.valid("param").id,
        c.req.valid("json")
      );

      return c.json({ thread }, 201);
    }
  )

  // The author or a panelist with a live seat answers in a thread.
  .post(
    "/cases/:id/threads/:threadId/replies",
    describeRoute({
      tags: ["reviews"],
      summary: "Reply in a comment thread",
      security: [{ bearerAuth: [] }],
      responses: {
        201: jsonContent(reviewThreadReplyResponseSchema, "The new reply"),
        ...errorResponses(400, 401, 403, 404, 409, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...CONTRIBUTION, bucket: "review-feedback" }),
    validate("param", threadParamSchema),
    validate("json", createReviewReplySchema),
    async (c) => {
      const { id, threadId } = c.req.valid("param");
      const reply = await replyToReviewThread(
        c.get("supabase"),
        getServiceSupabase(c),
        c.get("user").id,
        id,
        threadId,
        c.req.valid("json")
      );

      return c.json({ reply }, 201);
    }
  )

  // Only the author edits a comment, also after the case closes.
  .patch(
    "/cases/:id/threads/:threadId",
    describeRoute({
      tags: ["reviews"],
      summary: "Edit your comment",
      security: [{ bearerAuth: [] }],
      responses: {
        200: jsonContent(reviewThreadResponseSchema, "The edited thread"),
        ...errorResponses(400, 401, 403, 404, 409, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...CONTRIBUTION, bucket: "review-feedback" }),
    validate("param", threadParamSchema),
    validate("json", updateReviewCommentSchema),
    async (c) => {
      const { id, threadId } = c.req.valid("param");
      const thread = await editReviewThread(
        c.get("supabase"),
        getServiceSupabase(c),
        c.get("user").id,
        id,
        threadId,
        c.req.valid("json")
      );

      return c.json({ thread }, 200);
    }
  )

  // Deleting empties the comment but keeps its anchor and replies.
  .delete(
    "/cases/:id/threads/:threadId",
    describeRoute({
      tags: ["reviews"],
      summary: "Delete your comment",
      security: [{ bearerAuth: [] }],
      responses: {
        200: jsonContent(reviewThreadResponseSchema, "The deleted thread"),
        ...errorResponses(400, 401, 403, 404, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...CONTRIBUTION, bucket: "review-feedback" }),
    validate("param", threadParamSchema),
    async (c) => {
      const { id, threadId } = c.req.valid("param");
      const thread = await deleteReviewThread(
        c.get("supabase"),
        getServiceSupabase(c),
        c.get("user").id,
        id,
        threadId
      );

      return c.json({ thread }, 200);
    }
  )

  // Only the author edits a reply, also after the case closes.
  .patch(
    "/cases/:id/threads/:threadId/replies/:replyId",
    describeRoute({
      tags: ["reviews"],
      summary: "Edit your reply",
      security: [{ bearerAuth: [] }],
      responses: {
        200: jsonContent(reviewThreadReplyResponseSchema, "The edited reply"),
        ...errorResponses(400, 401, 403, 404, 409, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...CONTRIBUTION, bucket: "review-feedback" }),
    validate("param", replyParamSchema),
    validate("json", updateReviewCommentSchema),
    async (c) => {
      const { id, threadId, replyId } = c.req.valid("param");
      const reply = await editReviewReply(
        c.get("supabase"),
        getServiceSupabase(c),
        c.get("user").id,
        id,
        threadId,
        replyId,
        c.req.valid("json")
      );

      return c.json({ reply }, 200);
    }
  )

  // Deleting empties the reply but keeps its place in the thread.
  .delete(
    "/cases/:id/threads/:threadId/replies/:replyId",
    describeRoute({
      tags: ["reviews"],
      summary: "Delete your reply",
      security: [{ bearerAuth: [] }],
      responses: {
        200: jsonContent(reviewThreadReplyResponseSchema, "The deleted reply"),
        ...errorResponses(400, 401, 403, 404, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...CONTRIBUTION, bucket: "review-feedback" }),
    validate("param", replyParamSchema),
    async (c) => {
      const { id, threadId, replyId } = c.req.valid("param");
      const reply = await deleteReviewReply(
        c.get("supabase"),
        getServiceSupabase(c),
        c.get("user").id,
        id,
        threadId,
        replyId
      );

      return c.json({ reply }, 200);
    }
  )

  // A panelist proposes new text for one block. It stays a proposal until
  // the author accepts it, and an approval cannot publish past it.
  .post(
    "/cases/:id/suggestions",
    describeRoute({
      tags: ["reviews"],
      summary: "Suggest an edit to one block",
      security: [{ bearerAuth: [] }],
      responses: {
        201: jsonContent(reviewSuggestionResponseSchema, "The new suggestion"),
        ...errorResponses(400, 401, 403, 404, 409, 422, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...CONTRIBUTION, bucket: "review-feedback" }),
    validate("param", idParamSchema),
    validate("json", createReviewSuggestionSchema),
    async (c) => {
      const suggestion = await createReviewSuggestion(
        c.get("supabase"),
        getServiceSupabase(c),
        c.req.valid("param").id,
        c.req.valid("json")
      );

      return c.json({ suggestion }, 201);
    }
  )

  // The revision author accepts or rejects a suggested edit.
  .post(
    "/cases/:id/suggestions/:suggestionId/decision",
    describeRoute({
      tags: ["reviews"],
      summary: "Accept or reject a suggested edit",
      security: [{ bearerAuth: [] }],
      responses: {
        200: jsonContent(
          reviewSuggestionDecisionResponseSchema,
          "The answered suggestion and the case after the tally"
        ),
        ...errorResponses(400, 401, 403, 404, 409, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({
      ...CONTRIBUTION,
      bucket: "review-suggestion-decision",
    }),
    validate("param", suggestionParamSchema),
    validate("json", decideReviewSuggestionSchema),
    async (c) => {
      const { id, suggestionId } = c.req.valid("param");
      const result = await decideReviewSuggestion(
        c.get("supabase"),
        getServiceSupabase(c),
        id,
        suggestionId,
        c.req.valid("json")
      );
      // The last answer may have published the guide.
      scheduleSearchSync(
        c,
        syncGuideForReviewCase(c.env, c.get("supabase"), id)
      );
      return c.json(result, 200);
    }
  );
