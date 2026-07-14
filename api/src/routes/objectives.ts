import { Hono } from "hono";
import { requireUser } from "../middleware/auth.middleware";
import type { HonoEnv } from "../types";
import { zValidator } from "@hono/zod-validator";
import {
  createObjectiveSchema,
  rollbackRevisionSchema,
  updateObjectiveNodeSchema,
  updateObjectiveRevisionSchema,
} from "@bluelearn/schemas";
import {
  archiveObjective,
  createObjective,
  getObjectiveBySlug,
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

export const objectivesRouter = new Hono<HonoEnv>()
  // Returns published objectives as { objectives }.
  .get("/", async (c) => {
    const objectives = await listPublishedObjectives(c.get("supabase"));
    return c.json({ objectives });
  })

  // 201 with { revision_id } for the editor route.
  .post(
    "/",
    requireUser,
    zValidator("json", createObjectiveSchema),
    async (c) => {
      const { revision_id } = await createObjective(
        c.get("supabase"),
        c.req.valid("json")
      );
      return c.json({ revision_id }, 201);
    }
  )

  // Returns the objective and its live revision's snapshot as { objective, snapshot }.
  .get("/:slug", async (c) => {
    const { objective, snapshot } = await getObjectiveBySlug(
      c.get("supabase"),
      c.req.param("slug")
    );
    return c.json({ objective, snapshot });
  })

  // Archives the objective. 404 if missing or not permitted.
  .delete("/:slug", requireUser, async (c) => {
    const objective = await archiveObjective(
      c.get("supabase"),
      c.req.param("slug")
    );
    return c.json({ objective });
  })

  // Returns the revision history as { revisions }, newest first.
  .get("/:slug/revisions", async (c) => {
    const revisions = await listObjectiveRevisions(
      c.get("supabase"),
      c.req.param("slug")
    );
    return c.json({ revisions });
  })

  // 201 with { revision_id } for the new draft.
  .post("/:slug/revisions", requireUser, (c) =>
    c.json({ error: "Not implemented" }, 501)
  );

export const objectiveRevisionsRouter = new Hono<HonoEnv>()
  // Returns the revision's metadata, snapshot, and subject tags as { revision, snapshot, subjects }.
  .get("/:id", async (c) => {
    const { revision, snapshot, subjects } = await getObjectiveRevision(
      c.get("supabase"),
      c.req.param("id")
    );
    return c.json({ revision, snapshot, subjects });
  })

  // Overwrites a draft's metadata and/or tags. Returns { revision, subjects }; 404 if not an editable draft.
  .patch(
    "/:id",
    requireUser,
    zValidator("json", updateObjectiveRevisionSchema),
    async (c) => {
      const { revision, subjects } = await updateObjectiveRevision(
        c.get("supabase"),
        c.req.param("id"),
        c.req.valid("json")
      );
      return c.json({ revision, subjects });
    }
  )

  // Add a target: flag a base as a goal and pull its prerequisite closure into
  // the node set. Returns the recomputed snapshot.
  .post("/:id/targets", requireUser, (c) =>
    c.json({ error: "Not implemented" }, 501)
  )

  // Remove a target: clear the flag and remove topics kept only to reach it.
  // Returns the recomputed snapshot.
  .delete("/:id/targets/:baseId", requireUser, (c) =>
    c.json({ error: "Not implemented" }, 501)
  )

  // Edits one node of a draft. Returns { node }; 404 if missing or not editable.
  .patch(
    "/:id/nodes/:baseId",
    requireUser,
    zValidator("json", updateObjectiveNodeSchema),
    async (c) => {
      const { node } = await updateObjectiveNode(
        c.get("supabase"),
        c.req.param("id"),
        c.req.param("baseId"),
        c.req.valid("json")
      );
      return c.json({ node });
    }
  )

  // Publishes the draft. Returns { slug }; 403 unless the author/curator.
  .post("/:id/publish", requireUser, async (c) => {
    const { slug } = await publishObjectiveRevision(
      c.get("supabase"),
      c.req.param("id")
    );
    return c.json({ slug });
  })

  // 201 with { revision_id } for a new draft cloned from the body's revision_id.
  .post(
    "/:id/rollback",
    requireUser,
    zValidator("json", rollbackRevisionSchema),
    async (c) => {
      const { revision_id } = await rollbackObjectiveRevision(
        c.get("supabase"),
        c.req.param("id"),
        c.req.valid("json").revision_id
      );
      return c.json({ revision_id }, 201);
    }
  )

  // Returns the diff between two revision snapshots as { from, to, fields, nodes, edges }.
  .get("/:id/diff/:otherId", async (c) => {
    const { from, to, fields, nodes, edges } = await diffObjectiveRevisions(
      c.get("supabase"),
      c.req.param("id"),
      c.req.param("otherId")
    );
    return c.json({ from, to, fields, nodes, edges });
  });
