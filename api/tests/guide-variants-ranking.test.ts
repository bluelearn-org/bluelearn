import { describe, it, expect } from "vitest";
import app from "../src/index";
import { admin, env, makeUser } from "./helpers";
import {
  createGuide,
  createGuideRevision,
  createPublishedGuide,
  createVote,
} from "./factories/guides";
import { expectToMatchSpec } from "./openapi";

async function publishSiblingVariant(
  baseId: string,
  authorId: string | null,
  title: string
) {
  const guide = await createGuide(baseId, {
    status: "published",
    slug: `variant-${crypto.randomUUID().slice(0, 8)}`,
    author_id: authorId,
  });
  const revision = await createGuideRevision(guide.id, {
    title,
    body: "Body",
    author_id: authorId,
    status: "submitted",
    approved_at: new Date().toISOString(),
  });
  await admin
    .from("guides")
    .update({ current_revision_id: revision.id })
    .eq("id", guide.id)
    .throwOnError();
  return guide;
}

describe("GET /guides/{slug}/variants: ranking", () => {
  const OPTS = { timeout: 30000 };

  it(
    "orders variants by Wilson score, not by slug",
    async () => {
      const author = await makeUser();
      const { base, guide: incumbent } = await createPublishedGuide({
        authorId: author.userId,
        title: "Incumbent",
      });
      const challenger = await publishSiblingVariant(
        base.id,
        author.userId,
        "Challenger"
      );

      for (let i = 0; i < 2; i++) {
        const v = await makeUser();
        await createVote(v.userId, incumbent.id, { direction: "up" });
      }
      for (let i = 0; i < 20; i++) {
        const v = await makeUser();
        await createVote(v.userId, challenger.id, { direction: "up" });
      }

      const res = await app.request(`/guides/${base.slug}/variants`, {}, env);

      expect(res.status).toBe(200);
      await expectToMatchSpec(res, "GET", "/guides/{slug}/variants");
      const body = (await res.json()) as {
        variants: Array<{ id: string; slug: string }>;
      };
      const ids = body.variants.map((v) => v.id);
      expect(ids).toEqual([challenger.id, incumbent.id]);
    },
    OPTS
  );

  it(
    "lists published variants and omits drafts",
    async () => {
      const { base, guide } = await createPublishedGuide();
      const draft = await createGuide(base.id);

      const res = await app.request(`/guides/${base.slug}/variants`, {}, env);

      expect(res.status).toBe(200);
      await expectToMatchSpec(res, "GET", "/guides/{slug}/variants");
      const body = (await res.json()) as { variants: Array<{ id: string }> };
      const ids = body.variants.map((v) => v.id);
      expect(ids).toContain(guide.id);
      expect(ids).not.toContain(draft.id);
    },
    OPTS
  );
});
