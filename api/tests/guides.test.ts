import { describe, it, expect } from "vitest";
import app from "../src/index";
import { admin, auth, env, jsonAuth, makeUser } from "./helpers";
import { grantRole } from "./factories/identity";
import {
  createGuideBase,
  createGuide,
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

  it("creates a draft guide and returns its revision id", async () => {
    const { token } = await makeUser();

    const res = await app.request(
      "/guides",
      jsonAuth(token, "POST", {
        tags: ["algebra"],
        knowledge_type: "theory",
        title: "Limits",
        slug: `limits-${crypto.randomUUID().slice(0, 8)}`,
        body: "A first look at limits.",
      }),
      env
    );

    expect(res.status).toBe(201);
    await expectToMatchSpec(res, "POST", "/guides");
    const { revision_id } = (await res.json()) as { revision_id: string };

    const { data: revision } = await admin
      .from("guide_revisions")
      .select("status, title")
      .eq("id", revision_id)
      .single();
    expect(revision?.status).toBe("draft");
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
