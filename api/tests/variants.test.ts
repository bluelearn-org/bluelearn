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

describe("GET /variants/{id}", () => {
  it("returns a published variant with its vote tally", async () => {
    const voter = await makeUser();
    const { guide } = await createPublishedGuide();
    await createVote(voter.userId, guide.id, {
      direction: "down",
      reason: "unclear",
    });

    const res = await app.request(`/variants/${guide.id}`, {}, env);

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/variants/{id}");
    const body = (await res.json()) as {
      variant: { id: string; votes: { up: number; down: number } };
    };
    expect(body.variant.id).toBe(guide.id);
    expect(body.variant.votes).toEqual({ up: 0, down: 1 });
  });

  it("hides another author's draft variant", async () => {
    const { base } = await createPublishedGuide();
    const draft = await createGuide(base.id); // status defaults to draft

    const res = await app.request(`/variants/${draft.id}`, {}, env);

    expect(res.status).toBe(404);
    await expectToMatchSpec(res, "GET", "/variants/{id}");
  });
});

describe("DELETE /variants/{id}", () => {
  it("archives the caller's own variant", async () => {
    const author = await makeUser();
    const { guide } = await createPublishedGuide({ authorId: author.userId });

    const res = await app.request(
      `/variants/${guide.id}`,
      { method: "DELETE", ...auth(author.token) },
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "DELETE", "/variants/{id}");
    const body = (await res.json()) as { variant: { status: string } };
    expect(body.variant.status).toBe("archived");
  });

  it("404s for a stranger", async () => {
    const author = await makeUser();
    const { guide } = await createPublishedGuide({ authorId: author.userId });

    const stranger = await makeUser();
    const res = await app.request(
      `/variants/${guide.id}`,
      { method: "DELETE", ...auth(stranger.token) },
      env
    );

    expect(res.status).toBe(404);
    await expectToMatchSpec(res, "DELETE", "/variants/{id}");
  });
});

describe("PUT /variants/{id}/vote", () => {
  it("401s without a token", async () => {
    const { guide } = await createPublishedGuide();
    const res = await app.request(
      `/variants/${guide.id}/vote`,
      { method: "PUT" },
      env
    );
    expect(res.status).toBe(401);
    await expectToMatchSpec(res, "PUT", "/variants/{id}/vote");
  });

  it("records an upvote, then overwrites it on re-vote", async () => {
    const { guide } = await createPublishedGuide();
    const voter = await makeUser();

    const up = await app.request(
      `/variants/${guide.id}/vote`,
      jsonAuth(voter.token, "PUT", { direction: "up" }),
      env
    );
    expect(up.status).toBe(200);
    await expectToMatchSpec(up, "PUT", "/variants/{id}/vote");

    const down = await app.request(
      `/variants/${guide.id}/vote`,
      jsonAuth(voter.token, "PUT", {
        direction: "down",
        reason: "factually_wrong",
      }),
      env
    );
    expect(down.status).toBe(200);
    await expectToMatchSpec(down, "PUT", "/variants/{id}/vote");

    // Upsert on (voter, guide): one row, now downward.
    const { data: votes } = await admin
      .from("votes")
      .select("direction")
      .eq("voter_id", voter.userId)
      .eq("guide_id", guide.id);
    expect(votes).toHaveLength(1);
    expect(votes?.[0].direction).toBe("down");
  });

  it("400s when voting on an unpublished variant", async () => {
    // Archived is visible (so it passes the visibility check) but not published,
    // so the vote insert is refused by RLS and surfaces as 400, not 404.
    const { guide } = await createPublishedGuide();
    await admin
      .from("guides")
      .update({ status: "archived" })
      .eq("id", guide.id)
      .throwOnError();
    const voter = await makeUser();

    const res = await app.request(
      `/variants/${guide.id}/vote`,
      jsonAuth(voter.token, "PUT", { direction: "up" }),
      env
    );

    expect(res.status).toBe(400);
    await expectToMatchSpec(res, "PUT", "/variants/{id}/vote");
  });
});

describe("DELETE /variants/{id}/vote", () => {
  it("retracts the caller's vote", async () => {
    const { guide } = await createPublishedGuide();
    const voter = await makeUser();
    await createVote(voter.userId, guide.id);

    const res = await app.request(
      `/variants/${guide.id}/vote`,
      { method: "DELETE", ...auth(voter.token) },
      env
    );

    expect(res.status).toBe(204);
    const { data: votes } = await admin
      .from("votes")
      .select("voter_id")
      .eq("voter_id", voter.userId)
      .eq("guide_id", guide.id);
    expect(votes).toHaveLength(0);
  });

  it("is a no-op 204 when there is no vote to retract", async () => {
    const { guide } = await createPublishedGuide();
    const voter = await makeUser();

    const res = await app.request(
      `/variants/${guide.id}/vote`,
      { method: "DELETE", ...auth(voter.token) },
      env
    );

    expect(res.status).toBe(204);
  });
});

describe("GET /variants/{id}/revisions", () => {
  it("lists only the published (approved) revisions", async () => {
    const { guide, revision } = await createPublishedGuide();
    // An unapproved draft on the same variant must not appear.
    const draft = await createGuideRevision(guide.id, { status: "draft" });

    const res = await app.request(`/variants/${guide.id}/revisions`, {}, env);

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/variants/{id}/revisions");
    const body = (await res.json()) as {
      revisions: Array<{ id: string; status: string }>;
    };
    const ids = body.revisions.map((r) => r.id);
    expect(ids).toContain(revision.id);
    expect(ids).not.toContain(draft.id);
    expect(body.revisions.every((r) => r.status === "approved")).toBe(true);
  });
});

describe("POST /variants/{id}/revisions", () => {
  it("401s without a token", async () => {
    const { guide } = await createPublishedGuide();
    const res = await app.request(
      `/variants/${guide.id}/revisions`,
      { method: "POST" },
      env
    );
    expect(res.status).toBe(401);
    await expectToMatchSpec(res, "POST", "/variants/{id}/revisions");
  });

  it("opens a fresh draft seeded from the live revision", async () => {
    const author = await makeUser();
    const { guide } = await createPublishedGuide({ authorId: author.userId });

    const res = await app.request(
      `/variants/${guide.id}/revisions`,
      { method: "POST", ...auth(author.token) },
      env
    );

    expect(res.status).toBe(201);
    await expectToMatchSpec(res, "POST", "/variants/{id}/revisions");
    const { revision_id } = (await res.json()) as { revision_id: string };

    const { data: draft } = await admin
      .from("guide_revisions")
      .select("status, guide_id")
      .eq("id", revision_id)
      .single();
    expect(draft?.status).toBe("draft");
    expect(draft?.guide_id).toBe(guide.id);
  });
});

describe("POST /variants/{id}/rollback", () => {
  it("copies an older revision forward as a new draft", async () => {
    const author = await makeUser();
    const { guide, revision } = await createPublishedGuide({
      authorId: author.userId,
    });

    const res = await app.request(
      `/variants/${guide.id}/rollback`,
      jsonAuth(author.token, "POST", { revision_id: revision.id }),
      env
    );

    expect(res.status).toBe(201);
    await expectToMatchSpec(res, "POST", "/variants/{id}/rollback");
    const { revision_id } = (await res.json()) as { revision_id: string };
    expect(revision_id).not.toBe(revision.id);
  });

  it("404s when the source revision is not of this variant", async () => {
    const author = await makeUser();
    const { guide } = await createPublishedGuide({ authorId: author.userId });
    const other = await createPublishedGuide({ authorId: author.userId });

    const res = await app.request(
      `/variants/${guide.id}/rollback`,
      jsonAuth(author.token, "POST", { revision_id: other.revision.id }),
      env
    );

    expect(res.status).toBe(404);
    await expectToMatchSpec(res, "POST", "/variants/{id}/rollback");
  });
});
