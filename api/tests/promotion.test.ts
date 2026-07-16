import { describe, it, expect } from "vitest";
import app from "../src/index";
import { admin, auth, env, jsonAuth, makeUser } from "./helpers";
import {
  createGuide,
  createGuideRevision,
  createPublishedGuide,
  createVote,
} from "./factories/guides";
import { expectToMatchSpec } from "./openapi";

// Publish a sibling variant under an existing base. Returns the guide row.
async function publishSiblingVariant(baseId: string, authorId: string | null) {
  const guide = await createGuide(baseId, {
    status: "published",
    slug: `variant-${crypto.randomUUID().slice(0, 8)}`,
    author_id: authorId,
  });
  const revision = await createGuideRevision(guide.id, {
    title: "Sibling",
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

async function getCanonicalId(baseId: string): Promise<string | null> {
  const { data, error } = await admin
    .from("guide_bases")
    .select("canonical_guide_id")
    .eq("id", baseId)
    .single();
  if (error) throw error;
  return data.canonical_guide_id;
}

describe("PUT /variants/{id}/vote: canonical promotion", () => {
  // These tests create many users via Supabase Auth (slow locally), so a
  // generous timeout avoids false failures on cold starts.
  const OPTS = { timeout: 30000 };

  it(
    "promotes a challenger that beats the incumbent by the margin",
    async () => {
      const author = await makeUser();
      const { base, guide: incumbent } = await createPublishedGuide({
        authorId: author.userId,
      });
      const challenger = await publishSiblingVariant(base.id, author.userId);

      // Incumbent: 10 up / 2 down -> Wilson approx 0.72
      for (let i = 0; i < 10; i++) {
        const v = await makeUser();
        await createVote(v.userId, incumbent.id, { direction: "up" });
      }
      for (let i = 0; i < 2; i++) {
        const v = await makeUser();
        await createVote(v.userId, incumbent.id, {
          direction: "down",
          reason: "unclear",
        });
      }

      // Challenger: 20 up / 0 down -> Wilson approx 0.85 (margin > 0.05)
      const voters: { token: string; userId: string }[] = [];
      for (let i = 0; i < 20; i++) {
        voters.push(await makeUser());
      }
      // Seed 19 votes via factory (bypasses API), cast 20th via API to
      // observe the promotion field in the response.
      for (let i = 0; i < 19; i++) {
        await createVote(voters[i].userId, challenger.id, { direction: "up" });
      }
      expect(await getCanonicalId(base.id)).toBe(incumbent.id);

      const res = await app.request(
        `/variants/${challenger.id}/vote`,
        jsonAuth(voters[19].token, "PUT", { direction: "up" }),
        env
      );

      expect(res.status).toBe(200);
      await expectToMatchSpec(res, "PUT", "/variants/{id}/vote");
      const body = (await res.json()) as {
        vote: { direction: string };
        promotion: { canonical_guide_id: string; promoted: boolean };
      };
      expect(body.promotion.promoted).toBe(true);
      expect(body.promotion.canonical_guide_id).toBe(challenger.id);
      expect(await getCanonicalId(base.id)).toBe(challenger.id);
    },
    OPTS
  );

  it(
    "does not promote when the margin is below the threshold",
    async () => {
      const author = await makeUser();
      const { base, guide: incumbent } = await createPublishedGuide({
        authorId: author.userId,
      });
      const challenger = await publishSiblingVariant(base.id, author.userId);

      // Incumbent: 10 up / 0 down -> Wilson approx 0.72
      for (let i = 0; i < 10; i++) {
        const v = await makeUser();
        await createVote(v.userId, incumbent.id, { direction: "up" });
      }
      // Challenger: 11 up / 0 down -> Wilson approx 0.75 (margin < 0.05)
      const voters: { token: string; userId: string }[] = [];
      for (let i = 0; i < 11; i++) {
        voters.push(await makeUser());
      }
      for (let i = 0; i < 10; i++) {
        await createVote(voters[i].userId, challenger.id, { direction: "up" });
      }

      const res = await app.request(
        `/variants/${challenger.id}/vote`,
        jsonAuth(voters[10].token, "PUT", { direction: "up" }),
        env
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        promotion: { promoted: boolean };
      };
      expect(body.promotion.promoted).toBe(false);
      expect(await getCanonicalId(base.id)).toBe(incumbent.id);
    },
    OPTS
  );

  it(
    "does not promote a challenger below the minimum-vote floor",
    async () => {
      const author = await makeUser();
      const { base, guide: incumbent } = await createPublishedGuide({
        authorId: author.userId,
      });
      const challenger = await publishSiblingVariant(base.id, author.userId);

      // Incumbent: 5 up / 5 down -> Wilson approx 0.30
      for (let i = 0; i < 5; i++) {
        const v = await makeUser();
        await createVote(v.userId, incumbent.id, { direction: "up" });
      }
      for (let i = 0; i < 5; i++) {
        const v = await makeUser();
        await createVote(v.userId, incumbent.id, {
          direction: "down",
          reason: "unclear",
        });
      }

      // Challenger: 4 up / 0 down -> beats incumbent by > 0.05 but is
      // below the min_votes=5 floor.
      const voters: { token: string; userId: string }[] = [];
      for (let i = 0; i < 4; i++) {
        voters.push(await makeUser());
      }
      for (let i = 0; i < 3; i++) {
        await createVote(voters[i].userId, challenger.id, { direction: "up" });
      }

      const res = await app.request(
        `/variants/${challenger.id}/vote`,
        jsonAuth(voters[3].token, "PUT", { direction: "up" }),
        env
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        promotion: { promoted: boolean };
      };
      expect(body.promotion.promoted).toBe(false);
      expect(await getCanonicalId(base.id)).toBe(incumbent.id);
    },
    OPTS
  );
});

describe("DELETE /variants/{id}/vote: canonical promotion on retraction", () => {
  it("returns 200 with a promotion body", async () => {
    const author = await makeUser();
    const { guide: incumbent } = await createPublishedGuide({
      authorId: author.userId,
    });
    // Single-variant base: no flip possible, but the response shape must
    // still be { promotion: { canonical_guide_id, promoted } }.
    const voter = await makeUser();
    await createVote(voter.userId, incumbent.id, { direction: "up" });

    const res = await app.request(
      `/variants/${incumbent.id}/vote`,
      { method: "DELETE", ...auth(voter.token) },
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "DELETE", "/variants/{id}/vote");
    const body = (await res.json()) as {
      promotion: { canonical_guide_id: string; promoted: boolean };
    };
    expect(body.promotion.canonical_guide_id).toBe(incumbent.id);
    expect(body.promotion.promoted).toBe(false);
  });
});
