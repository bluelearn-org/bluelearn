import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { z } from "zod";
import {
  paginationSchema,
  subjectGroupsResponseSchema,
  subjectGuidesResponseSchema,
  subjectListResponseSchema,
  subjectObjectivesResponseSchema,
  subjectResponseSchema,
  subjectFollowResponseSchema,
} from "@bluelearn/schemas";
import {
  errorResponses,
  errorSchema,
  jsonContent,
  validate,
} from "../lib/openapi";
import type { HonoEnv } from "../types";
import { requireUser } from "../middleware/auth.middleware";
import { rateLimitMiddleware } from "../middleware/rate-limit.middleware";
import { CONTRIBUTION } from "../middleware/rateLimits";
import {
  getSubjectBySlug,
  getSubjectFollow,
  setSubjectFollow,
  listGroupedSubjects,
  listSubjectGuides,
  listSubjectObjectives,
  listSubjects,
} from "../services/subject.service";

const slugParamSchema = z.object({ slug: z.string() });

export const subjectsRouter = new Hono<HonoEnv>()
  .get(
    "/:slug/follow",
    describeRoute({
      tags: ["subjects"],
      summary: "Whether the caller follows this subject",
      security: [{ bearerAuth: [] }],
      responses: {
        200: jsonContent(
          subjectFollowResponseSchema,
          "The caller's follow state"
        ),
        ...errorResponses(400, 401, 404),
        500: jsonContent(errorSchema, "Failed to load subject follow"),
      },
    }),
    requireUser,
    validate("param", slugParamSchema),
    async (c) => {
      c.header("Cache-Control", "no-store");
      return c.json(
        await getSubjectFollow(
          c.get("supabase"),
          c.get("user").id,
          c.req.valid("param").slug
        )
      );
    }
  )
  .put(
    "/:slug/follow",
    describeRoute({
      tags: ["subjects"],
      summary: "Follow a subject for the caller",
      security: [{ bearerAuth: [] }],
      responses: {
        200: jsonContent(
          subjectFollowResponseSchema,
          "The subject is followed"
        ),
        ...errorResponses(400, 401, 403, 404, 429),
        500: jsonContent(errorSchema, "Failed to update subject follow"),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...CONTRIBUTION, bucket: "subject-follow" }),
    validate("param", slugParamSchema),
    async (c) => {
      c.header("Cache-Control", "no-store");
      return c.json(
        await setSubjectFollow(
          c.get("supabase"),
          c.get("user").id,
          c.req.valid("param").slug,
          true
        )
      );
    }
  )
  .delete(
    "/:slug/follow",
    describeRoute({
      tags: ["subjects"],
      summary: "Unfollow a subject for the caller",
      security: [{ bearerAuth: [] }],
      responses: {
        200: jsonContent(
          subjectFollowResponseSchema,
          "The subject is not followed"
        ),
        ...errorResponses(400, 401, 403, 404, 429),
        500: jsonContent(errorSchema, "Failed to update subject follow"),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...CONTRIBUTION, bucket: "subject-follow" }),
    validate("param", slugParamSchema),
    async (c) => {
      c.header("Cache-Control", "no-store");
      return c.json(
        await setSubjectFollow(
          c.get("supabase"),
          c.get("user").id,
          c.req.valid("param").slug,
          false
        )
      );
    }
  )
  // List all subjects
  .get(
    "/",
    describeRoute({
      tags: ["subjects"],
      summary: "List all subjects",
      responses: {
        200: jsonContent(subjectListResponseSchema, "All subjects"),
        ...errorResponses(400),
      },
    }),
    validate("query", paginationSchema),
    async (c) => {
      const { page, limit } = c.req.valid("query");
      const { data, total } = await listSubjects(c.get("supabase"), {
        page,
        limit,
      });
      return c.json({ subjects: data, total }, 200);
    }
  )

  // Every subject grouped by the first character of its name.
  .get(
    "/grouped",
    describeRoute({
      tags: ["subjects"],
      summary: "List subjects grouped by first character",
      responses: {
        200: jsonContent(subjectGroupsResponseSchema, "Grouped subjects"),
      },
    }),
    async (c) => {
      const groups = await listGroupedSubjects(c.get("supabase"));
      return c.json({ groups }, 200);
    }
  )

  // Subject metadata only
  .get(
    "/:slug",
    describeRoute({
      tags: ["subjects"],
      summary: "Get subject metadata",
      responses: {
        200: jsonContent(subjectResponseSchema, "The subject"),
        ...errorResponses(404),
      },
    }),
    validate("param", slugParamSchema),
    async (c) => {
      const subject = await getSubjectBySlug(
        c.get("supabase"),
        c.req.valid("param").slug
      );
      return c.json({ subject }, 200);
    }
  )

  // Alphabetical list of guides carrying this subject tag
  .get(
    "/:slug/guides",
    describeRoute({
      tags: ["subjects"],
      summary: "List guides tagged with this subject",
      responses: {
        200: jsonContent(subjectGuidesResponseSchema, "Tagged guides"),
        ...errorResponses(400, 404),
      },
    }),
    validate("param", slugParamSchema),
    validate("query", paginationSchema),
    async (c) => {
      const { page, limit } = c.req.valid("query");
      const { data, total } = await listSubjectGuides(
        c.get("supabase"),
        c.req.valid("param").slug,
        { page, limit }
      );
      return c.json({ guides: data, total }, 200);
    }
  )

  // Alphabetical list of published objectives tagged with this subject
  .get(
    "/:slug/objectives",
    describeRoute({
      tags: ["subjects"],
      summary: "List objectives tagged with this subject",
      responses: {
        200: jsonContent(subjectObjectivesResponseSchema, "Tagged objectives"),
        ...errorResponses(400, 404),
      },
    }),
    validate("param", slugParamSchema),
    validate("query", paginationSchema),
    async (c) => {
      const { page, limit } = c.req.valid("query");
      const { data, total } = await listSubjectObjectives(
        c.get("supabase"),
        c.req.valid("param").slug,
        { page, limit }
      );
      return c.json({ objectives: data, total }, 200);
    }
  );
