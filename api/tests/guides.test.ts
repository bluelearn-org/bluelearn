import { describe, it, expect } from "vitest";
import app from "../src/index";
import { admin, auth, env, jsonAuth, makeUser } from "./helpers";
import { grantRole } from "./factories/identity";
import {
  createGuideBase,
  createGuide,
  createGuideRevision,
  createPublishedGuide,
  createVote,
} from "./factories/guides";
import { createSubject, tagGuideRevision } from "./factories/subjects";
import { createPrerequisite } from "./factories/graph";
import { expectToMatchSpec } from "./openapi";

describe("GET /guides", () => {
  it("lists published guides and omits drafts", async () => {
    const published = await createPublishedGuide({ summary: "Summary" });
    const draft = await createGuideBase(); // status defaults to draft

    const res = await app.request("/guides", {}, env);

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/guides");
    const body = (await res.json()) as {
      guides: Array<{ id: string; summary: string | null }>;
    };
    const ids = body.guides.map((g) => g.id);
    expect(ids).toContain(published.base.id);
    expect(ids).not.toContain(draft.id);
    expect(body.guides.find((g) => g.id === published.base.id)?.summary).toBe(
      "Summary"
    );
  });
});

describe("POST /guides", () => {
  it("401s without a token", async () => {
    const res = await app.request("/guides", { method: "POST" }, env);
    expect(res.status).toBe(401);
    await expectToMatchSpec(res, "POST", "/guides");
  });

  it("creates a draft guide with its tags", async () => {
    const { token } = await makeUser();
    const subject = await createSubject();

    const res = await app.request(
      "/guides",
      jsonAuth(token, "POST", {
        knowledge_type: "theoretical",
        title: "Limits",
        summary: "A first look at limits.",
        body: "A first look at limits.",
        tags: [subject.slug],
      }),
      env
    );

    expect(res.status).toBe(201);
    await expectToMatchSpec(res, "POST", "/guides");
    const { revision_id } = (await res.json()) as { revision_id: string };

    const { data: revision } = await admin
      .from("guide_revisions")
      .select("status")
      .eq("id", revision_id)
      .single();
    expect(revision?.status).toBe("draft");

    const { data: tags } = await admin
      .from("guide_revision_subjects")
      .select("subject_id")
      .eq("guide_revision_id", revision_id);
    expect(tags?.map((t) => t.subject_id)).toEqual([subject.id]);
  });

  it("persists prerequisites, todos, and inline subjects", async () => {
    const { token } = await makeUser();
    const prereq = await createGuideBase({ status: "published" });
    const newName = `Fresh ${crypto.randomUUID().slice(0, 8)}`;

    const res = await app.request(
      "/guides",
      jsonAuth(token, "POST", {
        title: "Derivatives",
        summary: "Rates of change.",
        body: "Body.",
        newSubjects: [{ name: newName, summary: "About it" }],
        prerequisites: [prereq.slug],
        todoPrereqs: ["Learn limits"],
      }),
      env
    );

    expect(res.status).toBe(201);
    const { revision_id } = (await res.json()) as { revision_id: string };

    const { data: subject } = await admin
      .from("subjects")
      .select("id, status")
      .eq("slug", newName.toLowerCase().replace(" ", "-"))
      .single();
    expect(subject?.status).toBe("draft");

    const { data: tags } = await admin
      .from("guide_revision_subjects")
      .select("subject_id")
      .eq("guide_revision_id", revision_id);
    expect(tags?.map((t) => t.subject_id)).toEqual([subject?.id]);

    const { data: rev } = await admin
      .from("guide_revisions")
      .select("guide_id")
      .eq("id", revision_id)
      .single();
    const { data: guide } = await admin
      .from("guides")
      .select("guide_base_id")
      .eq("id", rev!.guide_id)
      .single();
    const baseId = guide!.guide_base_id;

    const { data: edges } = await admin
      .from("guide_edges")
      .select("from_guide_base_id")
      .eq("to_guide_base_id", baseId)
      .eq("edge_type", "prerequisite");
    expect(edges?.map((e) => e.from_guide_base_id)).toEqual([prereq.id]);

    const { data: todos } = await admin
      .from("todo_prerequisites")
      .select("title")
      .eq("dependent_guide_base_id", baseId);
    expect(todos?.map((t) => t.title)).toEqual(["Learn limits"]);
  });
});

describe("GET /guides/{slug}", () => {
  it("returns the guide with its subject tags", async () => {
    const { base, revision } = await createPublishedGuide({ body: "Content" });
    const subject = await createSubject();
    await tagGuideRevision(revision.id, subject.id);

    const res = await app.request(`/guides/${base.slug}`, {}, env);

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/guides/{slug}");
    const body = (await res.json()) as {
      guide: { id: string };
      subjects: Array<{ id: string }>;
    };
    expect(body.guide.id).toBe(base.id);
    expect(body.subjects.map((s) => s.id)).toContain(subject.id);
  });

  it("hides another author's draft guide", async () => {
    const { token } = await makeUser();
    const draft = await createGuideBase();

    const res = await app.request(`/guides/${draft.slug}`, auth(token), env);

    expect(res.status).toBe(404);
    await expectToMatchSpec(res, "GET", "/guides/{slug}");
  });
});

describe("DELETE /guides/{slug}", () => {
  it("archives the guide for a moderator", async () => {
    const { token, userId } = await makeUser();
    await grantRole(userId, "moderator");
    const { base } = await createPublishedGuide();

    const res = await app.request(
      `/guides/${base.slug}`,
      { method: "DELETE", ...auth(token) },
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "DELETE", "/guides/{slug}");
    const body = (await res.json()) as { guide: { status: string } };
    expect(body.guide.status).toBe("archived");
  });

  it("404s for a non-moderator on a published guide", async () => {
    const { token, userId } = await makeUser();
    const { base } = await createPublishedGuide({ authorId: userId });

    const res = await app.request(
      `/guides/${base.slug}`,
      { method: "DELETE", ...auth(token) },
      env
    );

    expect(res.status).toBe(404);
    await expectToMatchSpec(res, "DELETE", "/guides/{slug}");
  });
});

describe("GET /guides/{slug}/walkthrough", () => {
  it("returns the transitive prerequisite DAG", async () => {
    const prereq = await createPublishedGuide();
    const target = await createPublishedGuide();
    await createPrerequisite(prereq.base.id, target.base.id);

    const res = await app.request(
      `/guides/${target.base.slug}/walkthrough`,
      {},
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/guides/{slug}/walkthrough");
    const body = (await res.json()) as {
      nodes: Array<{ id: string; depth: number }>;
      edges: Array<{ from_id: string; to_id: string }>;
    };
    const ids = body.nodes.map((n) => n.id);
    expect(ids).toContain(target.base.id);
    expect(ids).toContain(prereq.base.id);
    expect(body.edges).toContainEqual({
      from_id: prereq.base.id,
      to_id: target.base.id,
    });
  });
});

// A second published variant under the same base, with a live revision.
async function publishSiblingVariant(baseId: string, title: string) {
  const guide = await createGuide(baseId, {
    status: "published",
    slug: `variant-${crypto.randomUUID().slice(0, 8)}`,
  });
  const revision = await createGuideRevision(guide.id, {
    title,
    body: "Body",
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

describe("GET /guides/{slug}/variants", () => {
  it("lists published variants and omits drafts", async () => {
    const { base, guide } = await createPublishedGuide();
    const draft = await createGuide(base.id); // status defaults to draft

    const res = await app.request(`/guides/${base.slug}/variants`, {}, env);

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/guides/{slug}/variants");
    const body = (await res.json()) as { variants: Array<{ id: string }> };
    const ids = body.variants.map((v) => v.id);
    expect(ids).toContain(guide.id);
    expect(ids).not.toContain(draft.id);
  });

  // 1 up / 1 down scores ~0.09, 3 up scores ~0.44, so the challenger leads
  // despite sorting later by slug.
  it("orders variants by Wilson score, not by slug", async () => {
    const { base, guide: incumbent } = await createPublishedGuide({
      title: "Incumbent",
    });
    const challenger = await publishSiblingVariant(base.id, "Challenger");

    const up = await makeUser();
    const down = await makeUser();
    await createVote(up.userId, incumbent.id, { direction: "up" });
    await createVote(down.userId, incumbent.id, {
      direction: "down",
      reason: "unclear",
    });
    for (let i = 0; i < 3; i++) {
      const voter = await makeUser();
      await createVote(voter.userId, challenger.id, { direction: "up" });
    }

    const res = await app.request(`/guides/${base.slug}/variants`, {}, env);

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/guides/{slug}/variants");
    const body = (await res.json()) as { variants: Array<{ id: string }> };
    const ids = body.variants.map((v) => v.id);
    expect(ids).toEqual([challenger.id, incumbent.id]);
  });
});

describe("POST /guides/{slug}/variants", () => {
  it("401s without a token", async () => {
    const { base } = await createPublishedGuide();
    const res = await app.request(
      `/guides/${base.slug}/variants`,
      { method: "POST" },
      env
    );
    expect(res.status).toBe(401);
    await expectToMatchSpec(res, "POST", "/guides/{slug}/variants");
  });

  it("creates a draft variant and returns its revision id", async () => {
    const { token } = await makeUser();
    const { base } = await createPublishedGuide();

    const res = await app.request(
      `/guides/${base.slug}/variants`,
      jsonAuth(token, "POST", { title: "Another method" }),
      env
    );

    expect(res.status).toBe(201);
    await expectToMatchSpec(res, "POST", "/guides/{slug}/variants");
    const { revision_id } = (await res.json()) as { revision_id: string };

    const { data: revision } = await admin
      .from("guide_revisions")
      .select("status, title")
      .eq("id", revision_id)
      .single();
    expect(revision?.title).toBe("Another method");
  });
});

describe("GET /guides/{slug}/{variantSlug}", () => {
  it("returns the variant with its vote tally", async () => {
    const voter = await makeUser();
    const { base, guide } = await createPublishedGuide();
    await createVote(voter.userId, guide.id);

    const res = await app.request(
      `/guides/${base.slug}/${guide.slug}`,
      {},
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/guides/{slug}/{variantSlug}");
    const body = (await res.json()) as {
      variant: { id: string; votes: { up: number; down: number } };
    };
    expect(body.variant.id).toBe(guide.id);
    expect(body.variant.votes).toEqual({ up: 1, down: 0 });
  });
});
