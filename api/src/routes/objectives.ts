import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { z } from "zod";
import { requireUser } from "../middleware/auth.middleware";
import { rateLimitMiddleware } from "../middleware/rate-limit.middleware";
import { CONTRIBUTION, CREATE } from "../middleware/rateLimits";
import type { HonoEnv } from "../types";
import {
  archivedObjectiveResponseSchema,
  contributorsResponseSchema,
  createObjectiveSchema,
  objectiveDetailResponseSchema,
  objectiveListResponseSchema,
  objectiveNodeResponseSchema,
  objectiveRevisionDetailResponseSchema,
  objectiveRevisionDiffSchema,
  objectiveRevisionListResponseSchema,
  objectiveRevisionUpdateResponseSchema,
  objectiveSlugResponseSchema,
  paginationSchema,
  revisionIdResponseSchema,
  rollbackRevisionSchema,
  updateObjectiveNodeSchema,
  updateObjectiveRevisionSchema,
} from "@bluelearn/schemas";
import { errorResponses, jsonContent, validate } from "../lib/openapi";
import {
  archiveObjective,
  createObjective,
  createObjectiveRevision,
  getObjectiveBySlug,
  listObjectiveContributors,
  listObjectiveRevisions,
  listPublishedObjectives,
} from "../services/objective.service";
import {
  diffObjectiveRevisions,
  getObjectiveRevision,
  publishObjectiveRevision,
  rollbackObjectiveRevision,
  updateObjectiveRevision,
  updateObjectiveNode,
} from "../services/objective-revision.service";
import {
  scheduleSearchSync,
  syncObjectiveDocument,
  syncObjectiveForRevision,
} from "../services/search.service";

const slugParamSchema = z.object({ slug: z.string() });
const idParamSchema = z.object({ id: z.uuid() });
const nodeParamSchema = z.object({ id: z.uuid(), baseId: z.uuid() });
const diffParamSchema = z.object({ id: z.uuid(), otherId: z.uuid() });

export const objectivesRouter = new Hono<HonoEnv>()
  // Returns published objectives as { objectives }.
  .get(
    "/",
    describeRoute({
      tags: ["objectives"],
      summary: "List published objectives",
      responses: {
        200: jsonContent(objectiveListResponseSchema, "Published objectives"),
        ...errorResponses(400),
      },
    }),
    validate("query", paginationSchema),
    async (c) => {
      const { page, limit } = c.req.valid("query");
      const { data, total } = await listPublishedObjectives(c.get("supabase"), {
        page,
        limit,
      });
      return c.json({ objectives: data, total });
    }
  )

  // 201 with { revision_id } for the editor route.
  .post(
    "/",
    describeRoute({
      tags: ["objectives"],
      summary: "Create a draft objective",
      security: [{ bearerAuth: [] }],
      responses: {
        201: jsonContent(
          revisionIdResponseSchema,
          "Created; draft revision id"
        ),
        ...errorResponses(400, 401, 403, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...CREATE, bucket: "objective-create" }),
    validate("json", createObjectiveSchema),
    async (c) => {
      const { revision_id } = await createObjective(
        c.get("supabase"),
        c.req.valid("json")
      );
      return c.json({ revision_id }, 201);
    }
  )

  // Returns the objective and its live revision's snapshot as { objective, snapshot }.
  .get(
    "/:slug",
    describeRoute({
      tags: ["objectives"],
      summary: "Open an objective",
      responses: {
        200: jsonContent(
          objectiveDetailResponseSchema,
          "The objective + its current snapshot"
        ),
        ...errorResponses(404),
      },
    }),
    validate("param", slugParamSchema),
    async (c) => {
      const { objective, snapshot } = await getObjectiveBySlug(
        c.get("supabase"),
        c.req.valid("param").slug
      );
      return c.json({ objective, snapshot });
    }
  )

  // Archives the objective. 404 if missing or not permitted.
  .delete(
    "/:slug",
    describeRoute({
      tags: ["objectives"],
      summary: "Archive an objective",
      security: [{ bearerAuth: [] }],
      responses: {
        200: jsonContent(
          archivedObjectiveResponseSchema,
          "The archived objective"
        ),
        ...errorResponses(401, 403, 404, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...CONTRIBUTION, bucket: "objective-archive" }),
    validate("param", slugParamSchema),
    async (c) => {
      const objective = await archiveObjective(
        c.get("supabase"),
        c.req.valid("param").slug
      );
      // Drop the archived objective from the search index (best-effort).
      scheduleSearchSync(
        c,
        syncObjectiveDocument(c.env, c.get("supabase"), objective.id)
      );
      return c.json({ objective });
    }
  )

  // Returns the revision history as { revisions }, newest first.
  .get(
    "/:slug/revisions",
    describeRoute({
      tags: ["objectives"],
      summary: "Revision history for this objective",
      responses: {
        200: jsonContent(
          objectiveRevisionListResponseSchema,
          "Revisions, newest first"
        ),
        ...errorResponses(400, 404),
      },
    }),
    validate("param", slugParamSchema),
    validate("query", paginationSchema),
    async (c) => {
      const { page, limit } = c.req.valid("query");
      const { data, total } = await listObjectiveRevisions(
        c.get("supabase"),
        c.req.valid("param").slug,
        { page, limit }
      );
      return c.json({ revisions: data, total });
    }
  )

  // 201 with { revision_id } for the new draft. 409 if nothing is published yet.
  .post(
    "/:slug/revisions",
    describeRoute({
      tags: ["objectives"],
      summary: "Start a new draft revision",
      security: [{ bearerAuth: [] }],
      responses: {
        201: jsonContent(
          revisionIdResponseSchema,
          "Created; draft revision id"
        ),
        ...errorResponses(401, 403, 404, 409, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({
      ...CONTRIBUTION,
      bucket: "objective-revision-create",
    }),
    validate("param", slugParamSchema),
    async (c) => {
      const { revision_id } = await createObjectiveRevision(
        c.get("supabase"),
        c.get("user").id,
        c.req.valid("param").slug
      );
      return c.json({ revision_id }, 201);
    }
  )

  // Returns the distinct revision authors as { contributors }.
  .get(
    "/:slug/contributors",
    describeRoute({
      tags: ["objectives"],
      summary: "List the objective's contributors",
      responses: {
        200: jsonContent(contributorsResponseSchema, "Distinct authors"),
        ...errorResponses(404),
      },
    }),
    validate("param", slugParamSchema),
    async (c) => {
      const { contributors } = await listObjectiveContributors(
        c.get("supabase"),
        c.req.valid("param").slug
      );
      return c.json({ contributors });
    }
  );

export const objectiveRevisionsRouter = new Hono<HonoEnv>()
  // Returns the revision's metadata, parent objective, snapshot, and subject tags
  // as { revision, objective, snapshot, subjects }.
  .get(
    "/:id",
    describeRoute({
      tags: ["objective-revisions"],
      summary: "Get a revision snapshot",
      responses: {
        200: jsonContent(
          objectiveRevisionDetailResponseSchema,
          "The revision snapshot"
        ),
        ...errorResponses(404),
      },
    }),
    validate("param", idParamSchema),
    async (c) => {
      const { revision, objective, snapshot, subjects } =
        await getObjectiveRevision(c.get("supabase"), c.req.valid("param").id);
      return c.json({ revision, objective, snapshot, subjects });
    }
  )

  // Overwrites a draft's metadata, tags, and/or target curation. Returns
  // { revision, subjects }; 404 if not an editable draft.
  .patch(
    "/:id",
    describeRoute({
      tags: ["objective-revisions"],
      summary: "Overwrite a draft revision's metadata or curation",
      security: [{ bearerAuth: [] }],
      responses: {
        200: jsonContent(
          objectiveRevisionUpdateResponseSchema,
          "The updated revision"
        ),
        ...errorResponses(400, 401, 403, 404, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({
      ...CONTRIBUTION,
      bucket: "objective-revision-update",
    }),
    validate("param", idParamSchema),
    validate("json", updateObjectiveRevisionSchema),
    async (c) => {
      const { revision, subjects } = await updateObjectiveRevision(
        c.get("supabase"),
        c.get("user").id,
        c.req.valid("param").id,
        c.req.valid("json")
      );
      return c.json({ revision, subjects });
    }
  )

  // Edits one node of a draft. Returns { node }; 404 if missing or not editable.
  .patch(
    "/:id/nodes/:baseId",
    describeRoute({
      tags: ["objective-revisions"],
      summary: "Update a node",
      security: [{ bearerAuth: [] }],
      responses: {
        200: jsonContent(objectiveNodeResponseSchema, "The updated node"),
        ...errorResponses(400, 401, 403, 404, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...CONTRIBUTION, bucket: "objective-node-update" }),
    validate("param", nodeParamSchema),
    validate("json", updateObjectiveNodeSchema),
    async (c) => {
      const { id, baseId } = c.req.valid("param");
      const { node } = await updateObjectiveNode(
        c.get("supabase"),
        id,
        baseId,
        c.req.valid("json")
      );
      return c.json({ node });
    }
  )

  // Publishes the draft. Returns { slug }; 403 unless the author/curator.
  .post(
    "/:id/publish",
    describeRoute({
      tags: ["objective-revisions"],
      summary: "Publish the revision",
      security: [{ bearerAuth: [] }],
      responses: {
        200: jsonContent(objectiveSlugResponseSchema, "Published"),
        ...errorResponses(401, 403, 404, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...CONTRIBUTION, bucket: "objective-publish" }),
    validate("param", idParamSchema),
    async (c) => {
      const id = c.req.valid("param").id;
      const { slug } = await publishObjectiveRevision(c.get("supabase"), id);
      // The objective just went (or stayed) live — refresh its search document.
      scheduleSearchSync(
        c,
        syncObjectiveForRevision(c.env, c.get("supabase"), id)
      );
      return c.json({ slug });
    }
  )

  // 201 with { revision_id } for a new draft cloned from the body's revision_id.
  .post(
    "/:id/rollback",
    describeRoute({
      tags: ["objective-revisions"],
      summary: "Roll back to an older revision",
      security: [{ bearerAuth: [] }],
      responses: {
        201: jsonContent(
          revisionIdResponseSchema,
          "Created; new draft revision id"
        ),
        ...errorResponses(400, 401, 403, 404, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...CONTRIBUTION, bucket: "objective-rollback" }),
    validate("param", idParamSchema),
    validate("json", rollbackRevisionSchema),
    async (c) => {
      const { revision_id } = await rollbackObjectiveRevision(
        c.get("supabase"),
        c.req.valid("param").id,
        c.req.valid("json").revision_id
      );
      return c.json({ revision_id }, 201);
    }
  )

  // Returns the diff between two revision snapshots as { from, to, fields, targets }.
  .get(
    "/:id/diff/:otherId",
    describeRoute({
      tags: ["objective-revisions"],
      summary: "Rendered diff between two revision snapshots",
      responses: {
        200: jsonContent(objectiveRevisionDiffSchema, "The rendered diff"),
        ...errorResponses(404),
      },
    }),
    validate("param", diffParamSchema),
    async (c) => {
      const { id, otherId } = c.req.valid("param");
      const { from, to, fields, targets } = await diffObjectiveRevisions(
        c.get("supabase"),
        id,
        otherId
      );
      return c.json({ from, to, fields, targets });
    }
  );
