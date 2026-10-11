import { describe, expect, it } from "vitest";
import app from "../src/index";
import { admin, auth, clientIp, env, jsonAuth, makeUser } from "./helpers";
import { grantRole } from "./factories/identity";
import { createPublishedGuide } from "./factories/guides";
import { createSubject } from "./factories/subjects";
import { expectToMatchSpec } from "./openapi";

type Tag = {
  id: string;
  slug: string | null;
  name: string;
  summary: string | null;
  status: string;
};

async function makeCurator() {
  const curator = await makeUser();
  await grantRole(curator.userId, "curator");
  return curator;
}

function uniqueName(prefix: string) {
  return `${prefix} ${crypto.randomUUID().slice(0, 8)}`;
}

async function create(token: string, body: unknown) {
  return app.request(
    "/objectives",
    jsonAuth(token, "POST", body, clientIp()),
    env
  );
}

async function createDraft(token: string, body: unknown) {
  const res = await create(token, body);
  expect(res.status).toBe(201);
  const { revision_id } = (await res.json()) as { revision_id: string };
  return revision_id;
}

function save(revisionId: string, token: string, body: unknown) {
  return app.request(
    `/objective-revisions/${revisionId}`,
    jsonAuth(token, "PATCH", body),
    env
  );
}

async function tagsOf(revisionId: string, token: string) {
  const res = await app.request(
    `/objective-revisions/${revisionId}`,
    auth(token),
    env
  );
  expect(res.status).toBe(200);
  await expectToMatchSpec(res, "GET", "/objective-revisions/{id}");
  const { subjects } = (await res.json()) as { subjects: Tag[] };
  return subjects;
}

async function subjectsNamed(name: string) {
  const { data } = await admin
    .from("subjects")
    .select("id, slug, status")
    .eq("name", name)
    .throwOnError();
  return data;
}

async function drawTarget(revisionId: string, token: string, title: string) {
  const goal = await createPublishedGuide();
  const drawn = await save(revisionId, token, {
    title,
    graph: {
      nodes: [{ id: crypto.randomUUID(), guide_base_id: goal.base.id }],
      edges: [],
    },
  });
  expect(drawn.status).toBe(200);
}

function publish(revisionId: string, token: string) {
  return app.request(
    `/objective-revisions/${revisionId}/publish`,
    { method: "POST", ...auth(token) },
    env
  );
}

async function publishWithTarget(
  revisionId: string,
  token: string,
  title = uniqueName("Objective")
) {
  await drawTarget(revisionId, token, title);

  const res = await publish(revisionId, token);
  expect(res.status).toBe(200);
  const { slug } = (await res.json()) as { slug: string };
  return slug;
}

describe("objective subjects proposed inline", () => {
  it("tags an existing subject and a proposed one on create", async () => {
    const curator = await makeCurator();
    const existing = await createSubject();
    const name = uniqueName("Soil");

    const revisionId = await createDraft(curator.token, {
      tags: [existing.id],
      newSubjects: [{ name, summary: "How soil feeds plants" }],
    });

    const tags = await tagsOf(revisionId, curator.token);
    expect(tags).toHaveLength(2);
    expect(tags.find((t) => t.id === existing.id)?.status).toBe("published");

    const proposed = tags.find((t) => t.name === name);
    expect(proposed).toMatchObject({
      slug: null,
      status: "draft",
      summary: "How soil feeds plants",
    });
  });

  it("keeps one proposed subject across repeated saves and a reopen", async () => {
    const curator = await makeCurator();
    const existing = await createSubject();
    const name = uniqueName("Compost");
    const proposal = { name, summary: "Feeding the soil" };

    const revisionId = await createDraft(curator.token, {
      tags: [existing.id],
      newSubjects: [proposal],
    });

    // The editor resends a proposal until it reopens the draft with its id.
    for (let i = 0; i < 2; i++) {
      const res = await save(revisionId, curator.token, {
        tags: [existing.id],
        newSubjects: [proposal],
      });
      expect(res.status).toBe(200);
      await expectToMatchSpec(res, "PATCH", "/objective-revisions/{id}");
    }

    const [created] = await subjectsNamed(name);
    expect(await subjectsNamed(name)).toHaveLength(1);

    const reopened = await save(revisionId, curator.token, {
      tags: [existing.id, created.id],
      newSubjects: [],
    });
    expect(reopened.status).toBe(200);

    const tags = await tagsOf(revisionId, curator.token);
    expect(tags.map((t) => t.id).sort()).toEqual(
      [existing.id, created.id].sort()
    );
    expect(await subjectsNamed(name)).toHaveLength(1);
  });

  it("drops a proposed subject the editor removed", async () => {
    const curator = await makeCurator();
    const existing = await createSubject();
    const name = uniqueName("Mulch");

    const revisionId = await createDraft(curator.token, {
      tags: [existing.id],
      newSubjects: [{ name, summary: "Covering soil" }],
    });

    const res = await save(revisionId, curator.token, {
      tags: [existing.id],
      newSubjects: [],
    });
    expect(res.status).toBe(200);

    const tags = await tagsOf(revisionId, curator.token);
    expect(tags.map((t) => t.id)).toEqual([existing.id]);
  });

  it("leaves an existing-only draft without any new subject", async () => {
    const curator = await makeCurator();
    const existing = await createSubject();

    const revisionId = await createDraft(curator.token, {
      tags: [existing.id],
    });

    const tags = await tagsOf(revisionId, curator.token);
    expect(tags.map((t) => t.id)).toEqual([existing.id]);

    const { data: minted } = await admin
      .from("subjects")
      .select("id")
      .eq("creator_id", curator.userId)
      .throwOnError();
    expect(minted).toEqual([]);
  });

  it("reuses a published subject with the same name", async () => {
    const curator = await makeCurator();
    const existing = await createSubject();

    const revisionId = await createDraft(curator.token, {
      newSubjects: [{ name: existing.name.toUpperCase(), summary: "Again" }],
    });

    const tags = await tagsOf(revisionId, curator.token);
    expect(tags.map((t) => t.id)).toEqual([existing.id]);

    const { data: minted } = await admin
      .from("subjects")
      .select("id")
      .eq("creator_id", curator.userId)
      .throwOnError();
    expect(minted).toEqual([]);
  });

  it("400s a proposed name without letters or digits and creates nothing", async () => {
    const curator = await makeCurator();

    const res = await create(curator.token, {
      title: uniqueName("Objective"),
      newSubjects: [{ name: "!!!", summary: "Nothing to slug" }],
    });

    expect(res.status).toBe(400);
    await expectToMatchSpec(res, "POST", "/objectives");

    const { data: objectives } = await admin
      .from("objectives")
      .select("id")
      .eq("created_by", curator.userId)
      .throwOnError();
    expect(objectives).toEqual([]);
  });

  it("400s a too-short proposed name on save and keeps the draft", async () => {
    const curator = await makeCurator();
    const existing = await createSubject();

    const revisionId = await createDraft(curator.token, {
      title: "Before",
      tags: [existing.id],
    });

    const res = await save(revisionId, curator.token, {
      title: "After",
      newSubjects: [{ name: "ab", summary: "Too short" }],
    });
    expect(res.status).toBe(400);

    const unslugged = await save(revisionId, curator.token, {
      title: "After",
      newSubjects: [{ name: "???", summary: "No handle" }],
    });
    expect(unslugged.status).toBe(400);

    const { data: revision } = await admin
      .from("objective_revisions")
      .select("title")
      .eq("id", revisionId)
      .single()
      .throwOnError();
    expect(revision.title).toBe("Before");
    expect((await tagsOf(revisionId, curator.token)).map((t) => t.id)).toEqual([
      existing.id,
    ]);
  });
});

describe("publishing an objective with a proposed subject", () => {
  it("publishes the subject and shows it on the live objective", async () => {
    const curator = await makeCurator();
    const existing = await createSubject();
    const name = uniqueName("Irrigation");

    const revisionId = await createDraft(curator.token, {
      tags: [existing.id],
      newSubjects: [{ name, summary: "Moving water" }],
    });

    expect(await subjectsNamed(name)).toEqual([
      expect.objectContaining({ slug: null, status: "draft" }),
    ]);

    const slug = await publishWithTarget(revisionId, curator.token);

    const [published] = await subjectsNamed(name);
    const handle = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    expect(published).toMatchObject({ slug: handle, status: "published" });

    const res = await app.request(`/objectives/${slug}`, {}, env);
    expect(res.status).toBe(200);
    const { objective } = (await res.json()) as {
      objective: { tags: Array<{ slug: string; name: string }> };
    };

    expect(objective.tags).toEqual(
      expect.arrayContaining([
        { slug: existing.slug, name: existing.name },
        { slug: handle, name },
      ])
    );
    expect(objective.tags).toHaveLength(2);
  });

  it("suffixes the slug when another subject already took the handle", async () => {
    const name = uniqueName("Greenhouse");
    const first = await makeCurator();
    const second = await makeCurator();

    const firstDraft = await createDraft(first.token, {
      newSubjects: [{ name, summary: "First proposal" }],
    });
    const secondDraft = await createDraft(second.token, {
      newSubjects: [{ name, summary: "Second proposal" }],
    });

    await publishWithTarget(firstDraft, first.token);
    await publishWithTarget(secondDraft, second.token);

    const handle = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const slugs = (await subjectsNamed(name)).map((s) => s.slug).sort();
    expect(slugs).toEqual([handle, `${handle}-2`]);
  });

  it("leaves the subject draft when publishing is refused", async () => {
    const curator = await makeCurator();
    const name = uniqueName("Orchard");

    const revisionId = await createDraft(curator.token, {
      title: uniqueName("Objective"),
      newSubjects: [{ name, summary: "Fruit trees" }],
    });

    // No target yet, so the publish is refused before anything is written.
    const res = await publish(revisionId, curator.token);
    expect(res.status).toBe(400);

    expect(await subjectsNamed(name)).toEqual([
      expect.objectContaining({ slug: null, status: "draft" }),
    ]);
  });

  it("rolls the subject back when the publish fails after promoting it", async () => {
    const title = uniqueName("Objective");
    const taken = await makeCurator();
    const takenDraft = await createDraft(taken.token, {});
    await publishWithTarget(takenDraft, taken.token, title);

    const curator = await makeCurator();
    const name = uniqueName("Vineyard");
    const revisionId = await createDraft(curator.token, {
      newSubjects: [{ name, summary: "Grapes" }],
    });

    // The objective slug is frozen last, after the subjects are promoted, so
    // the duplicate title fails the transaction late.
    await drawTarget(revisionId, curator.token, title);
    const res = await publish(revisionId, curator.token);
    expect(res.status).toBe(400);

    expect(await subjectsNamed(name)).toEqual([
      expect.objectContaining({ slug: null, status: "draft" }),
    ]);

    const { data: revision } = await admin
      .from("objective_revisions")
      .select("status")
      .eq("id", revisionId)
      .single()
      .throwOnError();
    expect(revision.status).toBe("draft");
  });
});

describe("proposing subjects without permission", () => {
  it("403s a non-curator create and mints no subject", async () => {
    const user = await makeUser();

    const res = await create(user.token, {
      newSubjects: [{ name: uniqueName("Beekeeping"), summary: "Hives" }],
    });
    expect(res.status).toBe(403);
    await expectToMatchSpec(res, "POST", "/objectives");

    const { data: minted } = await admin
      .from("subjects")
      .select("id")
      .eq("creator_id", user.userId)
      .throwOnError();
    expect(minted).toEqual([]);
  });

  it("404s another curator's draft and mints no subject", async () => {
    const author = await makeCurator();
    const stranger = await makeCurator();
    const revisionId = await createDraft(author.token, {});

    const res = await save(revisionId, stranger.token, {
      newSubjects: [{ name: uniqueName("Foraging"), summary: "Wild food" }],
    });
    expect(res.status).toBe(404);
    await expectToMatchSpec(res, "PATCH", "/objective-revisions/{id}");

    const { data: minted } = await admin
      .from("subjects")
      .select("id")
      .eq("creator_id", stranger.userId)
      .throwOnError();
    expect(minted).toEqual([]);
    expect(await tagsOf(revisionId, author.token)).toEqual([]);
  });
});
