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
import { createPrerequisite, createTodo } from "./factories/graph";
import { createGuideReviewCase, createReviewCase } from "./factories/reviews";
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

// A draft that passes the submit completeness check: title, summary, body,
// and tags.
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

// Create a submitted revision whose case came back rejected.
async function createRejectedSubmission(
  authorId: string,
  caseStatus: "rejected" | "approved" | "in_review" = "rejected"
) {
  const base = await createGuideBase();
  const guide = await createGuide(base.id, { author_id: authorId });
  const revision = await createGuideRevision(guide.id, {
    status: "submitted",
    author_id: authorId,
    summary: "A summary",
    body: "Some body",
  });
  const subject = await createSubject();
  await tagGuideRevision(revision.id, subject.id);
  const reviewCase = await createReviewCase(authorId, { status: caseStatus });
  await createGuideReviewCase(reviewCase.id, revision.id);
  return { base, guide, revision, subject, reviewCase };
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

  it("flags a variant draft so it resumes in the variant flow", async () => {
    const author = await makeUser();
    const { base } = await createPublishedGuide();
    const variant = await createGuide(base.id, { author_id: author.userId });
    const revision = await createGuideRevision(variant.id, {
      status: "draft",
      author_id: author.userId,
    });

    const res = await app.request(
      `/guide-revisions/${revision.id}`,
      auth(author.token),
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/guide-revisions/{id}");
    const body = (await res.json()) as {
      is_variant: boolean;
      base_slug: string | null;
    };
    expect(body.is_variant).toBe(true);
    expect(body.base_slug).toBe(base.slug);
  });

  it("does not flag the canonical guide's own revision", async () => {
    const author = await makeUser();
    const { revision } = await createPublishedGuide({
      authorId: author.userId,
    });

    const res = await app.request(
      `/guide-revisions/${revision.id}`,
      auth(author.token),
      env
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { is_variant: boolean };
    expect(body.is_variant).toBe(false);
  });

  it("marks a tag proposed inline as still draft", async () => {
    const author = await makeUser();
    const { revision } = await createDraftRevision(author.userId);
    const published = await createSubject();
    const newName = `Fresh ${crypto.randomUUID().slice(0, 8)}`;

    await app.request(
      `/guide-revisions/${revision.id}`,
      jsonAuth(author.token, "PATCH", {
        tags: [published.id],
        newSubjects: [{ name: newName, summary: "A pending subject" }],
      }),
      env
    );

    const res = await app.request(
      `/guide-revisions/${revision.id}`,
      auth(author.token),
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/guide-revisions/{id}");
    const body = (await res.json()) as {
      subjects: Array<{
        name: string;
        summary: string | null;
        status: string;
      }>;
    };
    const pending = body.subjects.find((s) => s.name === newName);
    expect(pending?.status).toBe("draft");
    expect(pending?.summary).toBe("A pending subject");
    expect(body.subjects.find((s) => s.name === published.name)?.status).toBe(
      "published"
    );
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
        tags: [existing.id],
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

    // The inline subject lands as a draft with no slug, hidden until this guide
    // is approved.
    const { data: created } = await admin
      .from("subjects")
      .select("status, slug")
      .eq("name", newName)
      .single();
    expect(created?.status).toBe("draft");
    expect(created?.slug).toBeNull();
  });

  it("keeps a subject that has no slug yet tagged across saves", async () => {
    const author = await makeUser();
    const { revision } = await createDraftRevision(author.userId);
    const existing = await createSubject();
    const newName = `Fresh ${crypto.randomUUID().slice(0, 8)}`;

    await app.request(
      `/guide-revisions/${revision.id}`,
      jsonAuth(author.token, "PATCH", {
        tags: [existing.id],
        newSubjects: [{ name: newName }],
      }),
      env
    );

    const { data: pending } = await admin
      .from("subjects")
      .select("id")
      .eq("name", newName)
      .single();

    const res = await app.request(
      `/guide-revisions/${revision.id}`,
      jsonAuth(author.token, "PATCH", {
        tags: [existing.id, pending!.id],
      }),
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "PATCH", "/guide-revisions/{id}");

    const { data: tags } = await admin
      .from("guide_revision_subjects")
      .select("subject_id")
      .eq("guide_revision_id", revision.id);
    expect(tags?.map((t) => t.subject_id).sort()).toEqual(
      [existing.id, pending!.id].sort()
    );
  });

  it("refuses prerequisite edits once the base is published", async () => {
    const author = await makeUser();
    const { base, guide } = await createPublishedGuide({
      authorId: author.userId,
    });
    const kept = await createGuideBase({ status: "published" });
    await createPrerequisite(kept.id, base.id);
    const draft = await createGuideRevision(guide.id, {
      status: "draft",
      author_id: author.userId,
    });
    const other = await createGuideBase({ status: "published" });

    const res = await app.request(
      `/guide-revisions/${draft.id}`,
      jsonAuth(author.token, "PATCH", { prerequisites: [other.slug] }),
      env
    );

    expect(res.status).toBe(422);
    await expectToMatchSpec(res, "PATCH", "/guide-revisions/{id}");

    // the live graph survives the rejected write
    const { data: edges } = await admin
      .from("guide_edges")
      .select("from_guide_base_id")
      .eq("to_guide_base_id", base.id)
      .eq("edge_type", "prerequisite");
    expect(edges?.map((e) => e.from_guide_base_id)).toEqual([kept.id]);
  });

  it("refuses todo edits once the base is published", async () => {
    const author = await makeUser();
    const { base, guide } = await createPublishedGuide({
      authorId: author.userId,
    });
    await createTodo(base.id, { title: "Learn vectors" });
    const draft = await createGuideRevision(guide.id, {
      status: "draft",
      author_id: author.userId,
    });

    const res = await app.request(
      `/guide-revisions/${draft.id}`,
      jsonAuth(author.token, "PATCH", { todoPrereqs: ["Learn matrices"] }),
      env
    );

    expect(res.status).toBe(422);

    const { data: todos } = await admin
      .from("todo_prerequisites")
      .select("title")
      .eq("dependent_guide_base_id", base.id);
    expect(todos?.map((t) => t.title)).toEqual(["Learn vectors"]);
  });

  it("still edits body on a published base", async () => {
    const author = await makeUser();
    const { guide } = await createPublishedGuide({ authorId: author.userId });
    const draft = await createGuideRevision(guide.id, {
      status: "draft",
      author_id: author.userId,
    });

    const res = await app.request(
      `/guide-revisions/${draft.id}`,
      jsonAuth(author.token, "PATCH", { body: "Revised body" }),
      env
    );

    expect(res.status).toBe(200);
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

  it("409s when another open review claims the same todo", async () => {
    const authorA = await makeUser();
    const { revision: revA, base: baseA } = await createCompleteDraft(
      authorA.userId
    );
    const todo = await createTodo(baseA.id);
    await admin
      .from("todo_claims")
      .insert({ todo_id: todo.id, guide_base_id: baseA.id })
      .throwOnError();
    const first = await app.request(
      `/guide-revisions/${revA.id}/submit`,
      { method: "POST", ...auth(authorA.token) },
      env
    );
    expect(first.status).toBe(201);

    const authorB = await makeUser();
    const { revision: revB, base: baseB } = await createCompleteDraft(
      authorB.userId
    );
    await admin
      .from("todo_claims")
      .insert({ todo_id: todo.id, guide_base_id: baseB.id })
      .throwOnError();
    const res = await app.request(
      `/guide-revisions/${revB.id}/submit`,
      { method: "POST", ...auth(authorB.token) },
      env
    );

    expect(res.status).toBe(409);
  });

  it("409s when the claimed todo was already fulfilled", async () => {
    const author = await makeUser();
    const { revision, base } = await createCompleteDraft(author.userId);
    const todo = await createTodo(base.id);
    await admin
      .from("todo_claims")
      .insert({ todo_id: todo.id, guide_base_id: base.id })
      .throwOnError();
    await admin
      .from("todo_prerequisites")
      .update({ status: "resolved", resolved_guide_base_id: base.id })
      .eq("id", todo.id)
      .throwOnError();
    const res = await app.request(
      `/guide-revisions/${revision.id}/submit`,
      { method: "POST", ...auth(author.token) },
      env
    );

    expect(res.status).toBe(409);
  });

  it("allows submit once the competing claim was rejected", async () => {
    const authorA = await makeUser();
    const { revision: revA, base: baseA } = await createCompleteDraft(
      authorA.userId
    );
    const todo = await createTodo(baseA.id);
    await admin
      .from("todo_claims")
      .insert({ todo_id: todo.id, guide_base_id: baseA.id })
      .throwOnError();
    const first = await app.request(
      `/guide-revisions/${revA.id}/submit`,
      { method: "POST", ...auth(authorA.token) },
      env
    );
    expect(first.status).toBe(201);
    const { review_case_id } = (await first.json()) as {
      review_case_id: string;
    };
    await admin
      .from("review_cases")
      .update({ status: "rejected" })
      .eq("id", review_case_id)
      .throwOnError();

    const authorB = await makeUser();
    const { revision: revB, base: baseB } = await createCompleteDraft(
      authorB.userId
    );
    await admin
      .from("todo_claims")
      .insert({ todo_id: todo.id, guide_base_id: baseB.id })
      .throwOnError();
    const res = await app.request(
      `/guide-revisions/${revB.id}/submit`,
      { method: "POST", ...auth(authorB.token) },
      env
    );

    expect(res.status).toBe(201);
  });
});

describe("POST /guide-revisions/{id}/revise", () => {
  it("forks a rejected submission into a draft carrying its tags", async () => {
    const author = await makeUser();
    const { revision, subject } = await createRejectedSubmission(author.userId);

    const res = await app.request(
      `/guide-revisions/${revision.id}/revise`,
      { method: "POST", ...auth(author.token) },
      env
    );

    expect(res.status).toBe(201);
    await expectToMatchSpec(res, "POST", "/guide-revisions/{id}/revise");
    const { revision_id } = (await res.json()) as { revision_id: string };
    expect(revision_id).not.toBe(revision.id);

    const { data: draft } = await admin
      .from("guide_revisions")
      .select(
        "status, title, body, guide_id, author_id, revised_from_revision_id"
      )
      .eq("id", revision_id)
      .single();
    expect(draft?.status).toBe("draft");
    expect(draft?.title).toBe(revision.title);
    expect(draft?.body).toBe(revision.body);
    expect(draft?.guide_id).toBe(revision.guide_id);
    expect(draft?.author_id).toBe(author.userId);
    expect(draft?.revised_from_revision_id).toBe(revision.id);

    const { data: tags } = await admin
      .from("guide_revision_subjects")
      .select("subject_id")
      .eq("guide_revision_id", revision_id);
    expect(tags?.map((t) => t.subject_id)).toEqual([subject.id]);

    // The rejected revision stays frozen so its closed case still shows it.
    const { data: original } = await admin
      .from("guide_revisions")
      .select("status")
      .eq("id", revision.id)
      .single();
    expect(original?.status).toBe("submitted");
  });

  it("points the fork's case id at the rejection for the editor", async () => {
    const author = await makeUser();
    const { revision, reviewCase } = await createRejectedSubmission(
      author.userId
    );

    const revised = await app.request(
      `/guide-revisions/${revision.id}/revise`,
      { method: "POST", ...auth(author.token) },
      env
    );
    const { revision_id } = (await revised.json()) as { revision_id: string };

    const res = await app.request(
      `/guide-revisions/${revision_id}`,
      auth(author.token),
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/guide-revisions/{id}");
    const body = (await res.json()) as { revised_from_case_id: string | null };
    expect(body.revised_from_case_id).toBe(reviewCase.id);
  });

  it("hands back the same draft on a second revise", async () => {
    const author = await makeUser();
    const { revision } = await createRejectedSubmission(author.userId);
    const post = () =>
      app.request(
        `/guide-revisions/${revision.id}/revise`,
        { method: "POST", ...auth(author.token) },
        env
      );

    const first = (await (await post()).json()) as { revision_id: string };
    const second = (await (await post()).json()) as { revision_id: string };

    expect(second.revision_id).toBe(first.revision_id);

    const { data: drafts } = await admin
      .from("guide_revisions")
      .select("id")
      .eq("revised_from_revision_id", revision.id);
    expect(drafts?.length).toBe(1);
  });

  it("404s for someone who did not author the submission", async () => {
    const author = await makeUser();
    const { revision } = await createRejectedSubmission(author.userId);

    const stranger = await makeUser();
    const res = await app.request(
      `/guide-revisions/${revision.id}/revise`,
      { method: "POST", ...auth(stranger.token) },
      env
    );

    expect(res.status).toBe(404);
    await expectToMatchSpec(res, "POST", "/guide-revisions/{id}/revise");
  });

  it("404s while the case is still open", async () => {
    const author = await makeUser();
    const { revision } = await createRejectedSubmission(
      author.userId,
      "in_review"
    );

    const res = await app.request(
      `/guide-revisions/${revision.id}/revise`,
      { method: "POST", ...auth(author.token) },
      env
    );

    expect(res.status).toBe(404);
    await expectToMatchSpec(res, "POST", "/guide-revisions/{id}/revise");
  });

  it("404s on an approved submission", async () => {
    const author = await makeUser();
    const { revision } = await createRejectedSubmission(
      author.userId,
      "approved"
    );

    const res = await app.request(
      `/guide-revisions/${revision.id}/revise`,
      { method: "POST", ...auth(author.token) },
      env
    );

    expect(res.status).toBe(404);
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
