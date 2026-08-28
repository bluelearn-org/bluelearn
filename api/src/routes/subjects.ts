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
} from "@bluelearn/schemas";
import { errorResponses, jsonContent, validate } from "../lib/openapi";
import type { HonoEnv } from "../types";
import {
  getSubjectBySlug,
  listGroupedSubjects,
  listSubjectGuides,
  listSubjectObjectives,
  listSubjects,
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
  );
