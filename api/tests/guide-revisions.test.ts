import { describe, it, expect } from "vitest";
import app from "../src/index";
import { admin, auth, env, jsonAuth, makeUser } from "./helpers";
import {
  createGuideBase,
  createGuide,
  createGuideRevision,
} from "./factories/guides";
import { expectToMatchSpec } from "./openapi";

// A draft revision owned by `authorId`, hanging off a fresh draft guide.
async function createDraftRevision(authorId: string) {
  const base = await createGuideBase();
  const guide = await createGuide(base.id, { author_id: authorId });
  return createGuideRevision(guide.id, {
    status: "draft",
    author_id: authorId,
  });
}

describe("GET /guide-revisions/{id}", () => {
  it("returns a submitted revision to any reader", async () => {
    const author = await makeUser();
    const base = await createGuideBase();
    const guide = await createGuide(base.id, { author_id: author.userId });
    const revision = await createGuideRevision(guide.id, {
      status: "submitted",
      author_id: author.userId,
    });

    const stranger = await makeUser();
    const res = await app.request(
      `/guide-revisions/${revision.id}`,
      auth(stranger.token),
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/guide-revisions/{id}");
    const body = (await res.json()) as { revision: { id: string } };
    expect(body.revision.id).toBe(revision.id);
  });

  it("hides another author's draft revision", async () => {
    const author = await makeUser();
    const revision = await createDraftRevision(author.userId);

    const stranger = await makeUser();
    const res = await app.request(
      `/guide-revisions/${revision.id}`,
      auth(stranger.token),
      env
    );

    expect(res.status).toBe(404);
    await expectToMatchSpec(res, "GET", "/guide-revisions/{id}");
  });
});

describe("PATCH /guide-revisions/{id}", () => {
  it("edits the author's own draft", async () => {
    const author = await makeUser();
    const revision = await createDraftRevision(author.userId);

    const res = await app.request(
      `/guide-revisions/${revision.id}`,
      jsonAuth(author.token, "PATCH", { title: "Revised title" }),
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "PATCH", "/guide-revisions/{id}");
    const body = (await res.json()) as { revision: { title: string } };
    expect(body.revision.title).toBe("Revised title");
  });

  it("404s for a non-author", async () => {
    const author = await makeUser();
    const revision = await createDraftRevision(author.userId);

    const stranger = await makeUser();
    const res = await app.request(
      `/guide-revisions/${revision.id}`,
      jsonAuth(stranger.token, "PATCH", { title: "Hijack" }),
      env
    );

    expect(res.status).toBe(404);
    await expectToMatchSpec(res, "PATCH", "/guide-revisions/{id}");
  });
});

describe("POST /guide-revisions/{id}/submit", () => {
  it("submits a draft and opens a review case", async () => {
    const author = await makeUser();
    const revision = await createDraftRevision(author.userId);

    const res = await app.request(
      `/guide-revisions/${revision.id}/submit`,
      { method: "POST", ...auth(author.token) },
      env
    );

    expect(res.status).toBe(201);
    await expectToMatchSpec(res, "POST", "/guide-revisions/{id}/submit");
    const { review_case_id } = (await res.json()) as { review_case_id: string };
    expect(review_case_id).toBeTruthy();

    const { data: revised } = await admin
      .from("guide_revisions")
      .select("status")
      .eq("id", revision.id)
      .single();
    expect(revised?.status).toBe("submitted");
  });

  it("404s when the revision is no longer an editable draft", async () => {
    const author = await makeUser();
    const revision = await createDraftRevision(author.userId);

    await app.request(
      `/guide-revisions/${revision.id}/submit`,
      { method: "POST", ...auth(author.token) },
      env
    );
    // Second submit: it is submitted now, so no editable draft to submit.
    const res = await app.request(
      `/guide-revisions/${revision.id}/submit`,
      { method: "POST", ...auth(author.token) },
      env
    );

    expect(res.status).toBe(404);
    await expectToMatchSpec(res, "POST", "/guide-revisions/{id}/submit");
  });
});

describe("GET /guide-revisions/{id}/diff/{otherId}", () => {
  // Contract-first: the diff endpoint is a 501 stub. This asserts the documented
  // 200 shape and stays red until the diff is implemented.
  it("returns the diff between two revisions", async () => {
    const author = await makeUser();
    const base = await createGuideBase();
    const guide = await createGuide(base.id, { author_id: author.userId });
    const a = await createGuideRevision(guide.id, {
      status: "submitted",
      author_id: author.userId,
    });
    const b = await createGuideRevision(guide.id, {
      status: "submitted",
      author_id: author.userId,
    });

    const res = await app.request(
      `/guide-revisions/${a.id}/diff/${b.id}`,
      {},
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/guide-revisions/{id}/diff/{otherId}");
  });
});
