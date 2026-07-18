import { describe, it, expect } from "vitest";
import app from "../src/index";
import { admin, auth, env, jsonAuth, makeUser } from "./helpers";
import {
  createGuideBase,
  createGuide,
  createGuideRevision,
  createPublishedGuide,
} from "./factories/guides";
import { createSubject, tagGuideRevision } from "./factories/subjects";
import { expectToMatchSpec } from "./openapi";

// A draft revision owned by `authorId`, hanging off a fresh draft guide.
async function createDraftRevision(authorId: string) {
  const base = await createGuideBase();
  const guide = await createGuide(base.id, { author_id: authorId });
  const revision = await createGuideRevision(guide.id, {
    status: "draft",
    author_id: authorId,
  });
  return { base, guide, revision };
}

// A draft that passes the submit completeness check: title, summary, body, tag.
async function createCompleteDraft(authorId: string) {
  const { base, guide, revision } = await createDraftRevision(authorId);
  await admin
    .from("guide_revisions")
    .update({ summary: "A summary", body: "Some body" })
    .eq("id", revision.id)
    .throwOnError();
  const subject = await createSubject();
  await tagGuideRevision(revision.id, subject.id);
  return { base, guide, revision, subject };
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
    const { revision } = await createDraftRevision(author.userId);

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
    const { revision } = await createDraftRevision(author.userId);

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
    const { revision } = await createDraftRevision(author.userId);

    const stranger = await makeUser();
    const res = await app.request(
      `/guide-revisions/${revision.id}`,
      jsonAuth(stranger.token, "PATCH", { title: "Hijack" }),
      env
    );

    expect(res.status).toBe(404);
    await expectToMatchSpec(res, "PATCH", "/guide-revisions/{id}");
  });

  it("applies tags, a new subject, a prerequisite, and a todo", async () => {
    const author = await makeUser();
    const { base, revision } = await createDraftRevision(author.userId);
    const existing = await createSubject();
    const prereq = await createGuideBase({ status: "published" });
    const newName = `Fresh ${crypto.randomUUID().slice(0, 8)}`;

    const res = await app.request(
      `/guide-revisions/${revision.id}`,
      jsonAuth(author.token, "PATCH", {
        tags: [existing.slug],
        prerequisites: [prereq.slug],
        newSubjects: [{ name: newName }],
        todoPrereqs: ["Learn functions"],
      }),
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "PATCH", "/guide-revisions/{id}");

    const { data: tags } = await admin
      .from("guide_revision_subjects")
      .select("subject_id")
      .eq("guide_revision_id", revision.id);
    expect(tags?.length).toBe(2);

    const { data: edges } = await admin
      .from("guide_edges")
      .select("from_guide_base_id")
      .eq("to_guide_base_id", base.id)
      .eq("edge_type", "prerequisite");
    expect(edges?.map((e) => e.from_guide_base_id)).toEqual([prereq.id]);

    const { data: todos } = await admin
      .from("todo_prerequisites")
      .select("title")
      .eq("dependent_guide_base_id", base.id);
    expect(todos?.map((t) => t.title)).toEqual(["Learn functions"]);

    // The inline subject lands as a draft, hidden until this guide is approved.
    const { data: created } = await admin
      .from("subjects")
      .select("status")
      .eq("slug", newName.toLowerCase().replace(" ", "-"))
      .single();
    expect(created?.status).toBe("draft");
  });
});

describe("POST /guide-revisions/{id}/submit", () => {
  it("submits a draft and opens a review case", async () => {
    const author = await makeUser();
    const { revision } = await createCompleteDraft(author.userId);

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

  it("422s when the draft is incomplete", async () => {
    const author = await makeUser();
    // Missing summary, body, and a tag.
    const { revision } = await createDraftRevision(author.userId);

    const res = await app.request(
      `/guide-revisions/${revision.id}/submit`,
      { method: "POST", ...auth(author.token) },
      env
    );

    expect(res.status).toBe(422);
    await expectToMatchSpec(res, "POST", "/guide-revisions/{id}/submit");
  });

  it("404s when the revision is no longer an editable draft", async () => {
    const author = await makeUser();
    const { revision } = await createCompleteDraft(author.userId);

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

describe("GET /guide-revisions/{id}/diff/prev", () => {
  it("returns the diff against the previous approved revision", async () => {
    const author = await makeUser();
    const { guide, revision: older } = await createPublishedGuide({
      authorId: author.userId,
    });
    const newer = await createGuideRevision(guide.id, {
      status: "submitted",
      author_id: author.userId,
      approved_at: new Date().toISOString(),
    });

    const res = await app.request(
      `/guide-revisions/${newer.id}/diff/prev`,
      {},
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/guide-revisions/{id}/diff/prev");
    const body = (await res.json()) as {
      from: { id: string };
      to: { id: string };
      fields: unknown;
    };
    expect(body.from.id).toBe(older.id);
    expect(body.to.id).toBe(newer.id);
  });

  it("diffs against the direct predecessor, not the newest revision", async () => {
    const author = await makeUser();
    const { guide } = await createPublishedGuide({ authorId: author.userId });
    const a = await createGuideRevision(guide.id, {
      status: "submitted",
      author_id: author.userId,
      approved_at: new Date(Date.now() - 30000).toISOString(),
    });
    const b = await createGuideRevision(guide.id, {
      status: "submitted",
      author_id: author.userId,
      approved_at: new Date(Date.now() - 20000).toISOString(),
    });
    // newer than b, must be ignored when diffing b/diff/prev
    await createGuideRevision(guide.id, {
      status: "submitted",
      author_id: author.userId,
      approved_at: new Date(Date.now() - 10000).toISOString(),
    });

    const res = await app.request(
      `/guide-revisions/${b.id}/diff/prev`,
      {},
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/guide-revisions/{id}/diff/prev");
    const body = (await res.json()) as {
      from: { id: string };
      to: { id: string };
    };
    expect(body.from.id).toBe(a.id);
    expect(body.to.id).toBe(b.id);
  });

  it("returns 404 when no previous revision exists", async () => {
    const author = await makeUser();
    const { revision } = await createPublishedGuide({
      authorId: author.userId,
    });

    const res = await app.request(
      `/guide-revisions/${revision.id}/diff/prev`,
      {},
      env
    );

    expect(res.status).toBe(404);
    await expectToMatchSpec(res, "GET", "/guide-revisions/{id}/diff/prev");
  });

  it("returns 404 for a non-existent revision", async () => {
    const res = await app.request(
      `/guide-revisions/00000000-0000-0000-0000-000000000000/diff/prev`,
      {},
      env
    );

    expect(res.status).toBe(404);
    await expectToMatchSpec(res, "GET", "/guide-revisions/{id}/diff/prev");
  });
});
