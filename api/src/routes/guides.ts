import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { z } from "zod";
import { requireUser } from "../middleware/auth.middleware";
import { rateLimitMiddleware } from "../middleware/rate-limit.middleware";
import { CONTRIBUTION, CREATE, MODERATION } from "../middleware/rateLimits";
import type { HonoEnv } from "../types";
import {
  archivedGuideResponseSchema,
  archivedVariantResponseSchema,
  castVoteSchema,
  contributorsResponseSchema,
  createGuideSchema,
  createVariantSchema,
  guideListResponseSchema,
  guideObjectiveListResponseSchema,
  guideRevisionDetailResponseSchema,
  guideRevisionDiffResponseSchema,
  guideRevisionListResponseSchema,
  guideRevisionUpdateResponseSchema,
  guideSchema,
  guideVariantListResponseSchema,
  myVoteResponseSchema,
  paginationSchema,
  reviewCaseIdResponseSchema,
  revisionIdResponseSchema,
  rollbackRevisionSchema,
  updateRevisionSchema,
  variantResponseSchema,
  voteResponseSchema,
  walkthroughSchema,
} from "@bluelearn/schemas";
import { errorResponses, jsonContent, validate } from "../lib/openapi";
import {
  addGuideVariant,
  archiveGuide,
  createGuide,
  getGuideBySlug,
  getVariantBySlug,
  getWalkthrough,
  listGuideVariants,
  listObjectivesForGuide,
  listPublishedGuides,
} from "../services/guide.service";
import {
  archiveVariant,
  castVote,
  createVariantRevision,
  getVariant,
  getVote,
  listVariantContributors,
  listVariantRevisions,
  retractVote,
  rollbackVariant,
} from "../services/variant.service";
import {
  diffRevisions,
  diffWithPrevious,
  getRevision,
  reviseRevision,
  submitRevision,
  updateRevision,
} from "../services/guide-revision.service";
import {
  scheduleSearchSync,
  syncGuideDocument,
} from "../services/search.service";

// Normalize a blank summary to NULL to match the create_guide RPC defaults.
const createGuideBody = createGuideSchema.extend({
  summary: createGuideSchema.shape.summary.transform((v) => v || null),
});

// Same NULL normalization for create_variant.
const createVariantBody = createVariantSchema.extend({
  summary: createVariantSchema.shape.summary.transform((v) => v || null),
  body: createVariantSchema.shape.body.transform((v) => v || null),
});

const slugParamSchema = z.object({ slug: z.string() });
const variantSlugParamSchema = z.object({
  slug: z.string(),
  variantSlug: z.string(),
});
const idParamSchema = z.object({ id: z.uuid() });
const diffParamSchema = z.object({ id: z.uuid(), otherId: z.uuid() });

export const guidesRouter = new Hono<HonoEnv>()
  // Returns published guides as { guides }.
  .get(
    "/",
    describeRoute({
      tags: ["guides"],
      summary: "List published guides",
      responses: {
        200: jsonContent(guideListResponseSchema, "Published guides"),
        ...errorResponses(400),
      },
    }),
    validate("query", paginationSchema),
    async (c) => {
      const { page, limit } = c.req.valid("query");
      const { data, total } = await listPublishedGuides(c.get("supabase"), {
        page,
        limit,
      });
      return c.json({ guides: data, total });
    }
  )

  // 201 with { revision_id } for the editor route.
  .post(
    "/",
    describeRoute({
      tags: ["guides"],
      summary: "Create a guide",
      security: [{ bearerAuth: [] }],
      responses: {
        201: jsonContent(
          revisionIdResponseSchema,
          "Created; draft revision id"
        ),
        ...errorResponses(400, 401, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...CREATE, bucket: "guide-create" }),
    validate("json", createGuideBody),
    async (c) => {
      const { revision_id } = await createGuide(
        c.get("supabase"),
        c.get("user").id,
        c.req.valid("json")
      );
      return c.json({ revision_id }, 201);
    }
  )

  // Returns the canonical variant's content, author, and subject tags.
  .get(
    "/:slug",
    describeRoute({
      tags: ["guides"],
      summary: "Get a guide by slug",
      responses: {
        200: jsonContent(guideSchema, "The guide's canonical content"),
        ...errorResponses(404),
      },
    }),
    validate("param", slugParamSchema),
    async (c) => {
      const guide = await getGuideBySlug(
        c.get("supabase"),
        c.req.valid("param").slug
      );
      return c.json(guide);
    }
  )

  // Archives the guide. 404 if missing or not permitted.
  .delete(
    "/:slug",
    describeRoute({
      tags: ["guides"],
      summary: "Archive a guide",
      security: [{ bearerAuth: [] }],
      responses: {
        200: jsonContent(archivedGuideResponseSchema, "The archived guide"),
        ...errorResponses(401, 404, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...CONTRIBUTION, bucket: "guide-archive" }),
    validate("param", slugParamSchema),
    async (c) => {
      const guide = await archiveGuide(
        c.get("supabase"),
        c.req.valid("param").slug
      );
      // Drop the archived guide from the search index (best-effort).
      scheduleSearchSync(
        c,
        syncGuideDocument(c.env, c.get("supabase"), guide.id)
      );
      return c.json({ guide });
    }
  )

  // Returns the transitive prerequisite graph as { nodes, edges }.
  .get(
    "/:slug/walkthrough",
    describeRoute({
      tags: ["guides"],
      summary: "Guide walkthrough (transitive prerequisite DAG)",
      responses: {
        200: jsonContent(walkthroughSchema, "The walkthrough graph"),
        ...errorResponses(404),
      },
    }),
    validate("param", slugParamSchema),
    async (c) => {
      const walkthrough = await getWalkthrough(
        c.get("supabase"),
        c.req.valid("param").slug
      );
      return c.json(walkthrough);
    }
  )

  // Returns the published variants as { variants }.
  .get(
    "/:slug/variants",
    describeRoute({
      tags: ["guides"],
      summary: "List variants under a guide",
      responses: {
        200: jsonContent(
          guideVariantListResponseSchema,
          "Variants under the guide"
        ),
        ...errorResponses(400, 404),
      },
    }),
    validate("param", slugParamSchema),
    validate("query", paginationSchema),
    async (c) => {
      const { page, limit } = c.req.valid("query");
      const { data, total } = await listGuideVariants(
        c.get("supabase"),
        c.req.valid("param").slug,
        { page, limit }
      );
      return c.json({ variants: data, total });
    }
  )

  // 201 with { revision_id } for the editor route.
  .post(
    "/:slug/variants",
    describeRoute({
      tags: ["guides"],
      summary: "Add a variant under a guide",
      security: [{ bearerAuth: [] }],
      responses: {
        201: jsonContent(
          revisionIdResponseSchema,
          "Created; draft revision id"
        ),
        ...errorResponses(400, 401, 404, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...CONTRIBUTION, bucket: "variant-create" }),
    validate("param", slugParamSchema),
    validate("json", createVariantBody),
    async (c) => {
      const { revision_id } = await addGuideVariant(
        c.get("supabase"),
        c.get("user").id,
        c.req.valid("param").slug,
        c.req.valid("json")
      );
      return c.json({ revision_id }, 201);
    }
  )

  // Returns objectives containing this guide.
  .get(
    "/:slug/objectives",
    describeRoute({
      tags: ["guides"],
      summary: "List objectives containing this guide",
      responses: {
        200: jsonContent(
          guideObjectiveListResponseSchema,
          "Objectives containing the guide"
        ),
        ...errorResponses(404),
      },
    }),
    validate("param", slugParamSchema),
    async (c) => {
      const { objectives, total } = await listObjectivesForGuide(
        c.get("supabase"),
        c.req.valid("param").slug
      );
      return c.json({ objectives, total });
    }
  )

  // Returns one published variant with its vote tally.
  .get(
    "/:slug/:variantSlug",
    describeRoute({
      tags: ["guides"],
      summary: "Get a variant by its slug",
      responses: {
        200: jsonContent(variantResponseSchema, "The variant detail"),
        ...errorResponses(404),
      },
    }),
    validate("param", variantSlugParamSchema),
    async (c) => {
      const { slug, variantSlug } = c.req.valid("param");
      const { variant } = await getVariantBySlug(
        c.get("supabase"),
        slug,
        variantSlug
      );
      return c.json({ variant });
    }
  );

export const variantsRouter = new Hono<HonoEnv>()
  // Returns the variant content and its vote tally as { variant }.
  .get(
    "/:id",
    describeRoute({
      tags: ["variants"],
      summary: "Get a variant",
      responses: {
        200: jsonContent(variantResponseSchema, "The variant detail"),
        ...errorResponses(404),
      },
    }),
    validate("param", idParamSchema),
    async (c) => {
      const { variant } = await getVariant(
        c.get("supabase"),
        c.req.valid("param").id
      );
      return c.json({ variant });
    }
  )

  // Archives the variant. 404 if missing or not permitted.
  .delete(
    "/:id",
    describeRoute({
      tags: ["variants"],
      summary: "Archive a variant",
      security: [{ bearerAuth: [] }],
      responses: {
        200: jsonContent(archivedVariantResponseSchema, "The archived variant"),
        ...errorResponses(401, 404, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...CONTRIBUTION, bucket: "variant-archive" }),
    validate("param", idParamSchema),
    async (c) => {
      const variant = await archiveVariant(
        c.get("supabase"),
        c.req.valid("param").id
      );
      return c.json({ variant });
    }
  )

  // Returns the caller's own vote as { vote }, null when they have not voted.
  .get(
    "/:id/vote",
    describeRoute({
      tags: ["variants"],
      summary: "Get the caller's own vote",
      security: [{ bearerAuth: [] }],
      responses: {
        200: jsonContent(myVoteResponseSchema, "The caller's vote, or null"),
        ...errorResponses(401, 404),
      },
    }),
    requireUser,
    validate("param", idParamSchema),
    async (c) => {
      const vote = await getVote(
        c.get("supabase"),
        c.get("user").id,
        c.req.valid("param").id
      );
      return c.json({ vote });
    }
  )

  // Stores the caller's vote; returns { vote }.
  .put(
    "/:id/vote",
    describeRoute({
      tags: ["variants"],
      summary: "Cast or update a vote",
      security: [{ bearerAuth: [] }],
      responses: {
        200: jsonContent(voteResponseSchema, "The stored vote"),
        ...errorResponses(400, 401, 404, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...MODERATION, bucket: "vote-cast" }),
    validate("param", idParamSchema),
    validate("json", castVoteSchema),
    async (c) => {
      const { vote } = await castVote(
        c.get("supabase"),
        c.get("user").id,
        c.req.valid("param").id,
        c.req.valid("json")
      );
      return c.json({ vote });
    }
  )

  // 204 once the caller's vote is gone.
  .delete(
    "/:id/vote",
    describeRoute({
      tags: ["variants"],
      summary: "Retract the caller's vote",
      security: [{ bearerAuth: [] }],
      responses: {
        204: { description: "Vote retracted" },
        ...errorResponses(401, 404, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...MODERATION, bucket: "vote-retract" }),
    validate("param", idParamSchema),
    async (c) => {
      await retractVote(
        c.get("supabase"),
        c.get("user").id,
        c.req.valid("param").id
      );
      return c.body(null, 204);
    }
  )

  // Returns the distinct authors of this variant's revisions as { contributors }.
  .get(
    "/:id/contributors",
    describeRoute({
      tags: ["variants"],
      summary: "List the variant's contributors",
      responses: {
        200: jsonContent(contributorsResponseSchema, "Distinct authors"),
        ...errorResponses(404),
      },
    }),
    validate("param", idParamSchema),
    async (c) => {
      const { contributors } = await listVariantContributors(
        c.get("supabase"),
        c.req.valid("param").id
      );
      return c.json({ contributors });
    }
  )

  // Returns the published versions as { revisions }, newest live first.
  .get(
    "/:id/revisions",
    describeRoute({
      tags: ["variants"],
      summary: "Published-version history for this variant",
      responses: {
        200: jsonContent(
          guideRevisionListResponseSchema,
          "Published versions, newest live first"
        ),
        ...errorResponses(400, 404),
      },
    }),
    validate("param", idParamSchema),
    validate("query", paginationSchema),
    async (c) => {
      const { page, limit } = c.req.valid("query");
      const { data, total } = await listVariantRevisions(
        c.get("supabase"),
        c.req.valid("param").id,
        { page, limit }
      );
      return c.json({ revisions: data, total });
    }
  )

  // 201 with { revision_id } for the editor route.
  .post(
    "/:id/revisions",
    describeRoute({
      tags: ["variants"],
      summary: "Start a new draft revision",
      security: [{ bearerAuth: [] }],
      responses: {
        201: jsonContent(
          revisionIdResponseSchema,
          "Created; draft revision id"
        ),
        ...errorResponses(401, 404, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...CONTRIBUTION, bucket: "variant-revision-create" }),
    validate("param", idParamSchema),
    async (c) => {
      const { revision_id } = await createVariantRevision(
        c.get("supabase"),
        c.get("user").id,
        c.req.valid("param").id
      );
      return c.json({ revision_id }, 201);
    }
  )

  // 201 with { revision_id } for the restored snapshot's new revision.
  .post(
    "/:id/rollback",
    describeRoute({
      tags: ["variants"],
      summary: "Roll back to an older revision",
      security: [{ bearerAuth: [] }],
      responses: {
        201: jsonContent(revisionIdResponseSchema, "Created; new revision id"),
        ...errorResponses(400, 401, 404, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...CONTRIBUTION, bucket: "variant-rollback" }),
    validate("param", idParamSchema),
    validate("json", rollbackRevisionSchema),
    async (c) => {
      const { revision_id } = await rollbackVariant(
        c.get("supabase"),
        c.get("user").id,
        c.req.valid("param").id,
        c.req.valid("json").revision_id
      );
      return c.json({ revision_id }, 201);
    }
  );

export const guideRevisionsRouter = new Hono<HonoEnv>()
  // Returns a revision snapshot, its subject tags, knowledge type, whether it is
  // a variant, its base and variant slugs, prerequisites, todos for resuming
  // the contribute flow, and revised_from_case_id for when the draft was
  // created from a rejected submission, so the editor can pull that
  // case's feedback.
  .get(
    "/:id",
    describeRoute({
      tags: ["guide-revisions"],
      summary: "Get a revision snapshot",
      responses: {
        200: jsonContent(
          guideRevisionDetailResponseSchema,
          "The revision snapshot"
        ),
        ...errorResponses(404),
      },
    }),
    validate("param", idParamSchema),
    async (c) => {
      const {
        revision,
        subjects,
        knowledge_type,
        is_variant,
        base_slug,
        variant_slug,
        prerequisites,
        todos,
        revised_from_case_id,
      } = await getRevision(c.get("supabase"), c.req.valid("param").id);
      return c.json({
        revision,
        subjects,
        knowledge_type,
        is_variant,
        base_slug,
        variant_slug,
        prerequisites,
        todos,
        revised_from_case_id,
      });
    }
  )

  // Overwrites a draft revision in place; returns { revision, subjects }. 404 once submitted.
  .patch(
    "/:id",
    describeRoute({
      tags: ["guide-revisions"],
      summary: "Overwrite a draft revision",
      security: [{ bearerAuth: [] }],
      responses: {
        200: jsonContent(
          guideRevisionUpdateResponseSchema,
          "The updated revision"
        ),
        ...errorResponses(400, 401, 404, 422, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...CONTRIBUTION, bucket: "guide-revision-update" }),
    validate("param", idParamSchema),
    validate("json", updateRevisionSchema),
    async (c) => {
      const { revision, subjects } = await updateRevision(
        c.get("supabase"),
        c.get("user").id,
        c.req.valid("param").id,
        c.req.valid("json")
      );
      return c.json({ revision, subjects });
    }
  )

  // 201 with { review_case_id } once the revision is submitted and its case opened.
  .post(
    "/:id/submit",
    describeRoute({
      tags: ["guide-revisions"],
      summary: "Submit a revision for review",
      security: [{ bearerAuth: [] }],
      responses: {
        201: jsonContent(reviewCaseIdResponseSchema, "Review case opened"),
        ...errorResponses(400, 401, 404, 422, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...CONTRIBUTION, bucket: "guide-revision-submit" }),
    validate("param", idParamSchema),
    async (c) => {
      const { review_case_id } = await submitRevision(
        c.get("supabase"),
        c.req.valid("param").id
      );
      return c.json({ review_case_id }, 201);
    }
  )

  // 201 with { revision_id } for the draft forked off this rejected submission.
  // Returns the draft already opened for it when there is one. 404 if the
  // revision is not the caller's own rejected submission.
  .post(
    "/:id/revise",
    describeRoute({
      tags: ["guide-revisions"],
      summary: "Revise a rejected submission",
      security: [{ bearerAuth: [] }],
      responses: {
        201: jsonContent(revisionIdResponseSchema, "The draft to edit"),
        ...errorResponses(401, 404, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...CONTRIBUTION, bucket: "guide-revision-revise" }),
    validate("param", idParamSchema),
    async (c) => {
      const { revision_id } = await reviseRevision(
        c.get("supabase"),
        c.req.valid("param").id
      );
      return c.json({ revision_id }, 201);
    }
  )

  // Returns the diff against the previous approved revision as { from, to, fields }.
  .get(
    "/:id/diff/prev",
    describeRoute({
      tags: ["guide-revisions"],
      summary: "Diff against the previous approved revision",
      responses: {
        200: jsonContent(guideRevisionDiffResponseSchema, "The rendered diff"),
        ...errorResponses(404),
      },
    }),
    validate("param", idParamSchema),
    async (c) => {
      const { from, to, fields } = await diffWithPrevious(
        c.get("supabase"),
        c.req.valid("param").id
      );
      return c.json({ from, to, fields });
    }
  )

  // Returns the diff between two revisions as { from, to, fields }.
  .get(
    "/:id/diff/:otherId",
    describeRoute({
      tags: ["guide-revisions"],
      summary: "Rendered diff between two revisions",
      responses: {
        200: jsonContent(guideRevisionDiffResponseSchema, "The rendered diff"),
        ...errorResponses(404),
      },
    }),
    validate("param", diffParamSchema),
    async (c) => {
      const { id, otherId } = c.req.valid("param");
      const { from, to, fields } = await diffRevisions(
        c.get("supabase"),
        id,
        otherId
      );
      return c.json({ from, to, fields });
    }
  );
