import { describe, it, expect } from "vitest";
import app from "../src/index";
import { admin, env, jsonAuth, makeUser } from "./helpers";
import {
  createSubject,
  tagGuideRevision,
  tagObjectiveRevision,
} from "./factories/subjects";
import { createPublishedGuide } from "./factories/guides";
import {
  addObjectiveNode,
  addObjectiveNodeOrder,
  createObjective,
  createObjectiveRevision,
  createPublishedObjective,
} from "./factories/objectives";
import { expectToMatchSpec } from "./openapi";

// Repeat a filler word so the stored word_count sees exactly `n`
// whitespace-separated words.
const words = (n: number) => Array(n).fill("word").join(" ");

describe("GET /subjects", () => {
  it("lists subjects", async () => {
    const subject = await createSubject();

    const res = await app.request("/subjects", {}, env);

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/subjects");
    const body = (await res.json()) as { subjects: Array<{ id: string }> };
    expect(body.subjects.map((s) => s.id)).toContain(subject.id);
  });

  it("totals the guides and objectives tagged with each subject", async () => {
    const { userId } = await makeUser();
    const subject = await createSubject();
    const target = await createPublishedGuide();

    const tagged = await createPublishedGuide();
    await tagGuideRevision(tagged.revision.id, subject.id);
    // Untagged nodes of both kinds exist, so a passing count means the totals
    // are scoped by tag rather than counting every published node.
    await createPublishedGuide();

    const objective = await createPublishedObjective(userId, target);
    await tagObjectiveRevision(objective.revision.id, subject.id);
    await createPublishedObjective(userId, target);

    const res = await app.request("/subjects", {}, env);

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/subjects");
    const body = (await res.json()) as {
      subjects: Array<{
        id: string;
        guides_total: number;
        objectives_total: number;
      }>;
    };
    const found = body.subjects.find((s) => s.id === subject.id);
    expect(found?.guides_total).toBe(1);
    expect(found?.objectives_total).toBe(1);
  });

  it("reports zero totals for a subject with no tags", async () => {
    const subject = await createSubject();

    const res = await app.request("/subjects", {}, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      subjects: Array<{
        id: string;
        guides_total: number;
        objectives_total: number;
      }>;
    };
    const found = body.subjects.find((s) => s.id === subject.id);
    expect(found?.guides_total).toBe(0);
    expect(found?.objectives_total).toBe(0);
  });
});

describe("POST /subjects", () => {
  it("401s without a token", async () => {
    const res = await app.request("/subjects", { method: "POST" }, env);
    expect(res.status).toBe(401);
    await expectToMatchSpec(res, "POST", "/subjects");
  });

  it("creates a subject with a slug derived from its name", async () => {
    const { token } = await makeUser();
    // subjectNameSchema caps names at 35 chars, so keep the unique part short.
    const name = `Algebra ${crypto.randomUUID().slice(0, 8)}`;

    const res = await app.request(
      "/subjects",
      jsonAuth(token, "POST", { name }),
      env
    );

    expect(res.status).toBe(201);
    await expectToMatchSpec(res, "POST", "/subjects");
    const body = (await res.json()) as {
      subject: { slug: string; name: string };
    };
    expect(body.subject.name).toBe(name);
    expect(body.subject.slug).toBe(name.toLowerCase().replaceAll(" ", "-"));
  });

  it("409s on a duplicate subject", async () => {
    const { token } = await makeUser();
    const subject = await createSubject();

    const res = await app.request(
      "/subjects",
      jsonAuth(token, "POST", { name: subject.name }),
      env
    );

    expect(res.status).toBe(409);
    await expectToMatchSpec(res, "POST", "/subjects");
  });
});

describe("GET /subjects/{slug}", () => {
  it("returns subject metadata", async () => {
    const subject = await createSubject();

    const res = await app.request(`/subjects/${subject.slug}`, {}, env);

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/subjects/{slug}");
    const body = (await res.json()) as { subject: { id: string } };
    expect(body.subject.id).toBe(subject.id);
  });
});

describe("GET /subjects/{slug}/guides", () => {
  it("lists tagged guides only", async () => {
    const subject = await createSubject();
    const tagged = await createPublishedGuide({ summary: "Tagged" });
    const untagged = await createPublishedGuide();
    await tagGuideRevision(tagged.revision.id, subject.id);

    const res = await app.request(`/subjects/${subject.slug}/guides`, {}, env);

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/subjects/{slug}/guides");
    const body = (await res.json()) as {
      guides: Array<{ id: string; summary: string | null }>;
    };
    const ids = body.guides.map((g) => g.id);
    expect(ids).toContain(tagged.base.id);
    expect(ids).not.toContain(untagged.base.id);
    expect(body.guides.find((g) => g.id === tagged.base.id)?.summary).toBe(
      "Tagged"
    );
  });

  it("shapes each guide for the card: duration, author, tags", async () => {
    const { userId } = await makeUser();
    const subject = await createSubject();
    const other = await createSubject();
    const guide = await createPublishedGuide({
      body: words(400),
      authorId: userId,
    });
    await tagGuideRevision(guide.revision.id, subject.id);
    await tagGuideRevision(guide.revision.id, other.id);

    const res = await app.request(`/subjects/${subject.slug}/guides`, {}, env);

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/subjects/{slug}/guides");
    const body = (await res.json()) as {
      guides: Array<{
        id: string;
        duration_minutes: number;
        author: string | null;
        tags: string[];
        created_at: string;
      }>;
    };
    const found = body.guides.find((g) => g.id === guide.base.id);
    expect(found?.duration_minutes).toBe(2); // 400 words / 200 wpm
    expect(found?.author).not.toBeNull();
    expect(found?.tags).toEqual(
      expect.arrayContaining([subject.slug, other.slug])
    );
    expect(found?.created_at).toBeTruthy();
  });
});

describe("GET /subjects/{slug}/objectives", () => {
  it("lists tagged objectives only, sorted alphabetically", async () => {
    const { userId } = await makeUser();
    const subject = await createSubject();
    const target = await createPublishedGuide();

    // Seed out of alphabetical order so a passing sort assertion means the
    // endpoint sorts, not the insert order.
    const beta = await createPublishedObjective(userId, target, {
      title: "Beta",
    });
    const alpha = await createPublishedObjective(userId, target, {
      title: "Alpha",
    });
    const untagged = await createPublishedObjective(userId, target, {
      title: "Gamma",
    });
    await tagObjectiveRevision(beta.revision.id, subject.id);
    await tagObjectiveRevision(alpha.revision.id, subject.id);

    const res = await app.request(
      `/subjects/${subject.slug}/objectives`,
      {},
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/subjects/{slug}/objectives");
    const body = (await res.json()) as {
      objectives: Array<{ id: string; title: string | null }>;
    };
    const ids = body.objectives.map((o) => o.id);
    // Scoped to this subject's tags, alphabetical by revision title.
    expect(ids).toEqual([alpha.objective.id, beta.objective.id]);
    expect(ids).not.toContain(untagged.objective.id);
  });

  it("builds the card: featured sub-objective, guide tally, curator, duration", async () => {
    const { userId } = await makeUser();
    const subject = await createSubject();

    const a = await createPublishedGuide({
      title: "Target A",
      body: words(200),
    });
    const b = await createPublishedGuide({
      title: "Middle B",
      body: words(200),
    });
    const c = await createPublishedGuide({ title: "Base C", body: words(200) });

    const objective = await createObjective(userId, {
      slug: `objective-${crypto.randomUUID()}`,
      status: "published",
    });
    const revision = await createObjectiveRevision(objective.id, {
      title: "My Objective",
      status: "published",
      published_at: new Date().toISOString(),
      author_id: userId,
    });
    const nodeA = await addObjectiveNode(revision.id, a.base.id, a.guide.id, {
      is_target: true,
      is_featured: true,
    });
    const nodeB = await addObjectiveNode(revision.id, b.base.id, b.guide.id);
    const nodeC = await addObjectiveNode(revision.id, c.base.id, c.guide.id);
    // The curator places C, B, A under the featured target A, so the featured
    // path renders in that order.
    await addObjectiveNodeOrder(revision.id, nodeA.id, nodeC.id, 0);
    await addObjectiveNodeOrder(revision.id, nodeA.id, nodeB.id, 1);
    await addObjectiveNodeOrder(revision.id, nodeA.id, nodeA.id, 2);
    await admin
      .from("objectives")
      .update({ current_revision_id: revision.id })
      .eq("id", objective.id)
      .throwOnError();
    await tagObjectiveRevision(revision.id, subject.id);

    const res = await app.request(
      `/subjects/${subject.slug}/objectives`,
      {},
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/subjects/{slug}/objectives");
    const body = (await res.json()) as {
      objectives: Array<{
        id: string;
        guides_total: number;
        duration_minutes: number;
        curator: string | null;
        featured_sub_objective: Array<{
          position: number;
          title: string | null;
        }>;
      }>;
    };
    const found = body.objectives.find((o) => o.id === objective.id);
    expect(found?.guides_total).toBe(3);
    expect(found?.duration_minutes).toBe(3); // 600 words / 200 wpm
    expect(found?.curator).not.toBeNull();
    expect(found?.featured_sub_objective.map((p) => p.title)).toEqual([
      "Base C",
      "Middle B",
      "Target A",
    ]);
    expect(found?.featured_sub_objective.map((p) => p.position)).toEqual([
      1, 2, 3,
    ]);
  });
});
