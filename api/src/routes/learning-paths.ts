import { Hono } from "hono"
import { requireUser } from "../middleware/auth.middleware"
import type { HonoEnv } from "../types"
import { zValidator } from "@hono/zod-validator"
import {
  createLearningPathSchema,
  rollbackRevisionSchema,
  updatePathNodeSchema,
  updatePathRevisionSchema,
} from "@bluelearn/schemas"
import {
  archiveLearningPath,
  createLearningPath,
  getLearningPathBySlug,
  listLearningPathRevisions,
  listPublishedLearningPaths,
} from "../services/learning-path.service"
import {
  getLearningPathRevision,
  publishLearningPathRevision,
  rollbackLearningPathRevision,
  updateLearningPathRevision,
  updatePathNode,
} from "../services/learning-path-revision.service"

export const learningPathsRouter = new Hono<HonoEnv>()
  // Returns published paths as { learning_paths }.
  .get("/", async (c) => {
    const learning_paths = await listPublishedLearningPaths(c.get("supabase"))
    return c.json({ learning_paths })
  })

  // 201 with { revision_id } for the editor route.
  .post("/", requireUser, zValidator("json", createLearningPathSchema), async (c) => {
    const { revision_id } = await createLearningPath(c.get("supabase"), c.req.valid("json"))
    return c.json({ revision_id }, 201)
  })

  // Returns the path and its live revision's snapshot as { path, snapshot }.
  .get("/:slug", async (c) => {
    const { path, snapshot } = await getLearningPathBySlug(c.get("supabase"), c.req.param("slug"))
    return c.json({ path, snapshot })
  })

  // Archives the path. 404 if missing or not permitted.
  .delete("/:slug", requireUser, async (c) => {
    const path = await archiveLearningPath(c.get("supabase"), c.req.param("slug"))
    return c.json({ path })
  })

  // Returns the revision history as { revisions }, newest first.
  .get("/:slug/revisions", async (c) => {
    const revisions = await listLearningPathRevisions(c.get("supabase"), c.req.param("slug"))
    return c.json({ revisions })
  })

  // 201 with { revision_id } for the new draft.
  .post("/:slug/revisions", requireUser, (c) => c.json({ error: "Not implemented" }, 501))

export const learningPathRevisionsRouter = new Hono<HonoEnv>()
  // Returns the revision's metadata and snapshot as { revision, snapshot }.
  .get("/:id", async (c) => {
    const { revision, snapshot } = await getLearningPathRevision(
      c.get("supabase"),
      c.req.param("id"),
    )
    return c.json({ revision, snapshot })
  })

  // Overwrites a draft's metadata. Returns { revision }; 404 if not an editable draft.
  .patch("/:id", requireUser, zValidator("json", updatePathRevisionSchema), async (c) => {
    const { revision } = await updateLearningPathRevision(
      c.get("supabase"),
      c.req.param("id"),
      c.req.valid("json"),
    )
    return c.json({ revision })
  })

  // Add a target: flag a base as a goal and pull its prerequisite closure into
  // the node set. Returns the recomputed snapshot.
  .post("/:id/targets", requireUser, (c) => c.json({ error: "Not implemented" }, 501))

  // Remove a target: clear the flag and remove topics kept only to reach it.
  // Returns the recomputed snapshot.
  .delete("/:id/targets/:baseId", requireUser, (c) => c.json({ error: "Not implemented" }, 501))

  // Edits one node of a draft. Returns { node }; 404 if missing or not editable.
  .patch("/:id/nodes/:baseId", requireUser, zValidator("json", updatePathNodeSchema), async (c) => {
    const { node } = await updatePathNode(
      c.get("supabase"),
      c.req.param("id"),
      c.req.param("baseId"),
      c.req.valid("json"),
    )
    return c.json({ node })
  })

  // Publishes the draft. Returns { slug }; 403 unless the author/curator.
  .post("/:id/publish", requireUser, async (c) => {
    const { slug } = await publishLearningPathRevision(c.get("supabase"), c.req.param("id"))
    return c.json({ slug })
  })

  // 201 with { revision_id } for a new draft cloned from the body's revision_id.
  .post("/:id/rollback", requireUser, zValidator("json", rollbackRevisionSchema), async (c) => {
    const { revision_id } = await rollbackLearningPathRevision(
      c.get("supabase"),
      c.req.param("id"),
      c.req.valid("json").revision_id,
    )
    return c.json({ revision_id }, 201)
  })

  // Rendered diff between two revision snapshots
  .get("/:id/diff/:otherId", (c) => c.json({ error: "Not implemented" }, 501))
