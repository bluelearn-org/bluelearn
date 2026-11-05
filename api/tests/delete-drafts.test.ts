import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import app from "../src/index";
import type { Database } from "../src/database.types";
import { admin, auth, env, jsonAuth, makeUser } from "./helpers";
import {
  createGuide,
  createGuideBase,
  createGuideRevision,
  createPublishedGuide,
} from "./factories/guides";
import {
  createObjective,
  createObjectiveRevision,
  createPublishedObjective,
} from "./factories/objectives";
import { suspendProfile } from "./factories/identity";
import { expectToMatchSpec } from "./openapi";

async function drafts(userId: string) {
  const base = await createGuideBase();
  const guide = await createGuide(base.id, { author_id: userId });
  const guideRevision = await createGuideRevision(guide.id, {
    author_id: userId,
    status: "draft",
  });
  const objective = await createObjective(userId);
  const objectiveRevision = await createObjectiveRevision(objective.id, {
    author_id: userId,
    status: "draft",
  });
  return { guideRevision, objectiveRevision, guide, objective };
}

const remove = (token: string, guides: string[], objectives: string[]) =>
  app.request(
    "/me/drafts",
    jsonAuth(token, "DELETE", {
      guide_revision_ids: guides,
      objective_revision_ids: objectives,
    }),
    env
  );
async function exists(
  table: "guide_revisions" | "objective_revisions",
  id: string
) {
  const { data } = await admin
    .from(table)
    .select("id")
    .eq("id", id)
    .maybeSingle()
    .throwOnError();
  return data !== null;
}

describe("DELETE /me/drafts", () => {
  it("requires authentication", async () => {
    const res = await app.request("/me/drafts", { method: "DELETE" }, env);
    expect(res.status).toBe(401);
    await expectToMatchSpec(res, "DELETE", "/me/drafts");
  });

  it("deletes multiple guide and objective drafts and removes them from the draft list", async () => {
    const user = await makeUser();
    const mine = await drafts(user.userId);
    const extra = await createGuideRevision(mine.guide.id, {
      author_id: user.userId,
      status: "draft",
    });
    const res = await remove(
      user.token,
      [mine.guideRevision.id, extra.id],
      [mine.objectiveRevision.id]
    );
    expect(res.status).toBe(204);
    expect(await exists("guide_revisions", mine.guideRevision.id)).toBe(false);
    expect(await exists("guide_revisions", extra.id)).toBe(false);
    expect(await exists("objective_revisions", mine.objectiveRevision.id)).toBe(
      false
    );
    const list = await app.request("/me/drafts", auth(user.token), env);
    expect(await list.json()).toEqual({
      guide_drafts: [],
      objective_drafts: [],
    });
  });

  it.each(["guide", "objective"] as const)(
    "rejects another author's %s and rolls back the entire batch",
    async (kind) => {
      const user = await makeUser();
      const other = await makeUser();
      const mine = await drafts(user.userId);
      const theirs = await drafts(other.userId);
      const res = await remove(
        user.token,
        [
          mine.guideRevision.id,
          ...(kind === "guide" ? [theirs.guideRevision.id] : []),
        ],
        [
          mine.objectiveRevision.id,
          ...(kind === "objective" ? [theirs.objectiveRevision.id] : []),
        ]
      );
      expect(res.status).toBe(404);
      await expectToMatchSpec(res, "DELETE", "/me/drafts");
      expect(await exists("guide_revisions", mine.guideRevision.id)).toBe(true);
      expect(
        await exists("objective_revisions", mine.objectiveRevision.id)
      ).toBe(true);
      expect(await exists("guide_revisions", theirs.guideRevision.id)).toBe(
        true
      );
      expect(
        await exists("objective_revisions", theirs.objectiveRevision.id)
      ).toBe(true);
    }
  );

  it.each(["guide", "objective"] as const)(
    "rejects a %s that was submitted or published after selection",
    async (kind) => {
      const user = await makeUser();
      const mine = await drafts(user.userId);
      if (kind === "guide") {
        await admin
          .from("guide_revisions")
          .update({ status: "submitted" })
          .eq("id", mine.guideRevision.id)
          .throwOnError();
      } else {
        await admin
          .from("objective_revisions")
          .update({ status: "published" })
          .eq("id", mine.objectiveRevision.id)
          .throwOnError();
      }
      const res = await remove(
        user.token,
        [mine.guideRevision.id],
        [mine.objectiveRevision.id]
      );
      expect(res.status).toBe(404);
      expect(await exists("guide_revisions", mine.guideRevision.id)).toBe(true);
      expect(
        await exists("objective_revisions", mine.objectiveRevision.id)
      ).toBe(true);
    }
  );

  it("doesn't remove published parents or their live revisions when discarding edits", async () => {
    const user = await makeUser();
    const published = await createPublishedGuide({ authorId: user.userId });
    const objective = await createPublishedObjective(user.userId, published);
    const edit = await createGuideRevision(published.guide.id, {
      author_id: user.userId,
      status: "draft",
    });
    const objectiveEdit = await createObjectiveRevision(
      objective.objective.id,
      { author_id: user.userId, status: "draft" }
    );
    expect(
      (await remove(user.token, [edit.id], [objectiveEdit.id])).status
    ).toBe(204);
    expect(await exists("guide_revisions", published.revision.id)).toBe(true);
    expect(await exists("objective_revisions", objective.revision.id)).toBe(
      true
    );
    const guide = await admin
      .from("guides")
      .select("current_revision_id")
      .eq("id", published.guide.id)
      .single()
      .throwOnError();
    const path = await admin
      .from("objectives")
      .select("current_revision_id")
      .eq("id", objective.objective.id)
      .single()
      .throwOnError();
    expect(guide.data.current_revision_id).toBe(published.revision.id);
    expect(path.data.current_revision_id).toBe(objective.revision.id);
  });

  it("rolls back when a selected revision has already been deleted", async () => {
    const user = await makeUser();
    const mine = await drafts(user.userId);
    expect(
      (await remove(user.token, [mine.guideRevision.id], [crypto.randomUUID()]))
        .status
    ).toBe(404);
    expect(await exists("guide_revisions", mine.guideRevision.id)).toBe(true);
  });

  it.each([
    { guide_revision_ids: [], objective_revision_ids: [] },
    { guide_revision_ids: ["invalid"], objective_revision_ids: [] },
    {
      guide_revision_ids: Array.from({ length: 101 }, () =>
        crypto.randomUUID()
      ),
      objective_revision_ids: [],
    },
    {
      guide_revision_ids: [
        "31500000-0000-4000-8000-000000000001",
        "31500000-0000-4000-8000-000000000001",
      ],
      objective_revision_ids: [],
    },
  ])("rejects invalid selections: %j", async (input) => {
    const user = await makeUser();
    const res = await app.request(
      "/me/drafts",
      jsonAuth(user.token, "DELETE", input),
      env
    );
    expect(res.status).toBe(400);
  });

  it("enforces ownership and draft status on direct database deletes too", async () => {
    const user = await makeUser();
    const other = await makeUser();
    const mine = await drafts(user.userId);
    const theirs = await drafts(other.userId);
    await admin
      .from("guide_revisions")
      .update({ status: "submitted" })
      .eq("id", mine.guideRevision.id)
      .throwOnError();
    await admin
      .from("objective_revisions")
      .update({ status: "published" })
      .eq("id", mine.objectiveRevision.id)
      .throwOnError();
    const client = createClient<Database>(
      env.SUPABASE_URL,
      env.SUPABASE_PUBLISHABLE_KEY,
      {
        global: { headers: { Authorization: `Bearer ${user.token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );
    for (const [table, ids] of [
      ["guide_revisions", [mine.guideRevision.id, theirs.guideRevision.id]],
      [
        "objective_revisions",
        [mine.objectiveRevision.id, theirs.objectiveRevision.id],
      ],
    ] as const) {
      const result = await client
        .from(table)
        .delete()
        .in("id", [...ids])
        .select("id");
      expect(result.error).toBeNull();
      expect(result.data).toEqual([]);
      for (const id of ids) expect(await exists(table, id)).toBe(true);
    }
  });

  it("keeps the suspension restriction on guide mutations", async () => {
    const user = await makeUser();
    const mine = await drafts(user.userId);
    await suspendProfile(user.userId);
    expect((await remove(user.token, [mine.guideRevision.id], [])).status).toBe(
      404
    );
    expect(await exists("guide_revisions", mine.guideRevision.id)).toBe(true);
  });
});
