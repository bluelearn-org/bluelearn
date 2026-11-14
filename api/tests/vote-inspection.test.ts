import { describe, expect, it } from "vitest";
import { downvoteInspectionResponseSchema } from "@bluelearn/schemas";
import app from "../src/index";
import { admin, auth, env, jsonAuth, makeUser, userClient } from "./helpers";
import {
  createGuideRevision,
  createPublishedGuide,
  createVote,
} from "./factories/guides";
import {
  createGuideReviewCase,
  createReviewCase,
  createVerifier,
} from "./factories/reviews";
import { expectToMatchSpec } from "./openapi";

async function fixture() {
  const author = await makeUser();
  const voter = await makeUser();
  const { guide } = await createPublishedGuide({ authorId: author.userId });
  const revision = await createGuideRevision(guide.id, {
    author_id: author.userId,
  });
  const reviewCase = await createReviewCase(author.userId, {
    case_type: "guide_edit",
    status: "in_review",
  });
  await createGuideReviewCase(reviewCase.id, revision.id);

  const preference = await app.request(
    "/notifications/preferences/guide_downvotes",
    jsonAuth(author.token, "PUT", { enabled: true }),
    env
  );
  expect(preference.status).toBe(200);

  await createVote(voter.userId, guide.id, {
    direction: "down",
    reason: "missing_step",
    note: "Explain the second step.",
  });
  const { data: profile } = await admin
    .from("profiles")
    .select("username")
    .eq("id", voter.userId)
    .single()
    .throwOnError();

  return { author, voter, guide, reviewCase, username: profile!.username };
}

type StaffRole = "verifier" | "moderator" | "curator" | "admin" | "official";

async function userWithRole(role: StaffRole) {
  const user = await makeUser();
  await admin
    .from("user_roles")
    .insert({ user_id: user.userId, role })
    .throwOnError();
  return user;
}

async function inspect(token: string, guideId: string) {
  return app.request(`/variants/${guideId}/downvotes`, auth(token), env);
}

describe("Downvote inspection", () => {
  it.each(["verifier", "moderator", "curator", "admin", "official"] as const)(
    "shows a %s the voter, reason, and note",
    async (role) => {
      const f = await fixture();
      const viewer = await userWithRole(role);
      const response = await inspect(viewer.token, f.guide.id);

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      await expectToMatchSpec(response, "GET", "/variants/{id}/downvotes");
      const body = downvoteInspectionResponseSchema.parse(
        await response.json()
      );
      expect(body).toEqual({
        total: 1,
        votes: [
          expect.objectContaining({
            voter_id: f.voter.userId,
            username: f.username,
            reason: "missing_step",
            note: "Explain the second step.",
          }),
        ],
      });
    }
  );

  it("keeps the author's downvote notification anonymous", async () => {
    const f = await fixture();
    const response = await app.request(
      "/notifications",
      auth(f.author.token),
      env
    );
    expect(response.status).toBe(200);
    const notices = (await response.json()) as {
      notifications: Array<{ type: string; actor: unknown; data: unknown }>;
    };
    const downvote = notices.notifications.find(
      (notice) => notice.type === "guide_downvotes"
    );

    expect(downvote?.actor).toBeNull();
    expect(downvote?.data).toMatchObject({
      feedback: [{ reason: "missing_step", note: "Explain the second step." }],
    });
    expect(JSON.stringify(downvote)).not.toContain(f.voter.userId);
    expect(JSON.stringify(downvote)).not.toContain(f.username!);
  });

  it("denies the author, a plain user, and anonymous callers through the API and direct RPC", async () => {
    const f = await fixture();
    const plain = await makeUser();
    const anonymous = await app.request(
      `/variants/${f.guide.id}/downvotes`,
      {},
      env
    );
    expect(anonymous.status).toBe(401);

    for (const user of [f.author, plain]) {
      expect((await inspect(user.token, f.guide.id)).status).toBe(403);
      const direct = await userClient(user.token).rpc(
        "inspect_guide_downvotes",
        { p_guide_id: f.guide.id }
      );
      expect(direct.error?.code).toBe("42501");
      const rows = await userClient(user.token)
        .from("votes")
        .select("voter_id")
        .eq("guide_id", f.guide.id);
      expect(rows.error).toBeNull();
      expect(rows.data).toEqual([]);
    }
  });

  it("revokes access on suspension and on role removal", async () => {
    const f = await fixture();
    const verifier = await createVerifier();
    expect((await inspect(verifier.token, f.guide.id)).status).toBe(200);

    await admin
      .from("user_statuses")
      .update({ status: "suspended" })
      .eq("user_id", verifier.userId)
      .throwOnError();
    expect((await inspect(verifier.token, f.guide.id)).status).toBe(403);

    await admin
      .from("user_statuses")
      .update({ status: "active" })
      .eq("user_id", verifier.userId)
      .throwOnError();
    await admin
      .from("user_roles")
      .delete()
      .eq("user_id", verifier.userId)
      .eq("role", "verifier")
      .throwOnError();
    expect((await inspect(verifier.token, f.guide.id)).status).toBe(403);
  });

  it("resolves a review case to its own guide only", async () => {
    const f = await fixture();
    const other = await createPublishedGuide();
    await createVote(f.voter.userId, other.guide.id, {
      direction: "down",
      reason: "unclear",
    });
    const verifier = await createVerifier();
    const response = await app.request(
      `/reviews/cases/${f.reviewCase.id}/downvotes`,
      auth(verifier.token),
      env
    );

    expect(response.status).toBe(200);
    await expectToMatchSpec(response, "GET", "/reviews/cases/{id}/downvotes");
    const body = downvoteInspectionResponseSchema.parse(await response.json());
    expect(body.votes).toEqual([
      expect.objectContaining({
        voter_id: f.voter.userId,
        reason: "missing_step",
      }),
    ]);
  });

  it("paginates current downvotes without mixing in upvotes", async () => {
    const f = await fixture();
    const verifier = await createVerifier();
    const second = await makeUser();
    const upvoter = await makeUser();
    await createVote(second.userId, f.guide.id, {
      direction: "down",
      reason: "unclear",
    });
    await createVote(upvoter.userId, f.guide.id);
    const ids = [];

    for (const page of [1, 2]) {
      const response = await app.request(
        `/variants/${f.guide.id}/downvotes?page=${page}&limit=1`,
        auth(verifier.token),
        env
      );
      expect(response.status).toBe(200);
      const body = downvoteInspectionResponseSchema.parse(
        await response.json()
      );
      expect(body.total).toBe(2);
      ids.push(...body.votes.map((vote) => vote.voter_id));
    }

    expect(ids.sort()).toEqual([f.voter.userId, second.userId].sort());
    const invalid = await userClient(verifier.token).rpc(
      "inspect_guide_downvotes",
      { p_guide_id: f.guide.id, p_limit: 101 }
    );
    expect(invalid.error?.code).toBe("22023");
  });
});
