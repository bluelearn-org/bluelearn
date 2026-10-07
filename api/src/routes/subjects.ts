import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { z } from "zod";
import {
  paginationSchema,
  setSubjectFloorSchema,
  subjectFloorResponseSchema,
  subjectGroupsResponseSchema,
  subjectGuidesResponseSchema,
  subjectListResponseSchema,
  subjectObjectivesResponseSchema,
  subjectResponseSchema,
} from "@bluelearn/schemas";
import { errorResponses, jsonContent, validate } from "../lib/openapi";
import { requireUser } from "../middleware/auth.middleware";
import { rateLimitMiddleware } from "../middleware/rate-limit.middleware";
import { MODERATION } from "../middleware/rateLimits";
import type { HonoEnv } from "../types";
import {
  getSubjectBySlug,
  getSubjectFloor,
  listGroupedSubjects,
  listSubjectGuides,
  listSubjectObjectives,
  listSubjects,
  setSubjectFloor,
} from "../services/subject.service";

const slugParamSchema = z.object({ slug: z.string() });

export const subjectsRouter = new Hono<HonoEnv>()
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
  )

  // The subject's prerequisite floor: the guides a walkthrough scoped to this
  // subject treats as assumed knowledge and does not expand below.
  .get(
    "/:slug/floor",
    describeRoute({
      tags: ["subjects"],
      summary: "Get the subject's prerequisite floor",
      responses: {
        200: jsonContent(
          subjectFloorResponseSchema,
          "Guide bases in the floor"
        ),
        ...errorResponses(404),
      },
    }),
    validate("param", slugParamSchema),
    async (c) => {
      const floor = await getSubjectFloor(
        c.get("supabase"),
        c.req.valid("param").slug
      );
      return c.json({ floor }, 200);
    }
  )

  // Replace the floor as a whole. Governance-only: anyone but an admin gets 403.
  .put(
    "/:slug/floor",
    describeRoute({
      tags: ["subjects"],
      summary: "Set the subject's prerequisite floor",
      security: [{ bearerAuth: [] }],
      responses: {
        200: jsonContent(subjectFloorResponseSchema, "The floor as saved"),
        ...errorResponses(400, 401, 403, 404, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...MODERATION, bucket: "subject-floor" }),
    validate("param", slugParamSchema),
    validate("json", setSubjectFloorSchema),
    async (c) => {
      const floor = await setSubjectFloor(
        c.get("supabase"),
        c.req.valid("param").slug,
        c.req.valid("json").guide_base_ids
      );
      return c.json({ floor }, 200);
    }
  );
