import { describe, it, expect } from "vitest";
import app from "../src/index";
import { auth, env, jsonAuth, makeUser } from "./helpers";
import { grantRole } from "./factories/identity";
import { createPublishedGuide } from "./factories/guides";
import {
  addPathNode,
  createLearningPath,
  createPathRevision,
  createPublishedPath,
} from "./factories/learning-paths";
import { expectToMatchSpec } from "./openapi";

// A curator with an owned draft path + draft revision, ready to edit.
async function curatorDraft() {
  const curator = await makeUser();
  await grantRole(curator.userId, "curator");
  const path = await createLearningPath(curator.userId); // draft
  const revision = await createPathRevision(path.id, {
    author_id: curator.userId,
    status: "draft",
  });
  return { curator, path, revision };
}

describe("GET /path-revisions/{id}", () => {
  it("returns a published revision's metadata and snapshot", async () => {
    const creator = await makeUser();
    const target = await createPublishedGuide();
    const { revision } = await createPublishedPath(creator.userId, target);

    const res = await app.request(`/path-revisions/${revision.id}`, {}, env);

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/path-revisions/{id}");
    const body = (await res.json()) as { revision: { id: string } };
    expect(body.revision.id).toBe(revision.id);
  });

  it("404s for an unknown revision", async () => {
    const res = await app.request(
      `/path-revisions/${crypto.randomUUID()}`,
      {},
      env
    );
    expect(res.status).toBe(404);
    await expectToMatchSpec(res, "GET", "/path-revisions/{id}");
  });
});

describe("PATCH /path-revisions/{id}", () => {
  it("edits the author's own draft metadata", async () => {
    const { curator, revision } = await curatorDraft();

    const res = await app.request(
      `/path-revisions/${revision.id}`,
      jsonAuth(curator.token, "PATCH", { title: "Revised path" }),
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "PATCH", "/path-revisions/{id}");
    const body = (await res.json()) as { revision: { title: string } };
    expect(body.revision.title).toBe("Revised path");
  });

  it("404s for a non-author", async () => {
    const { revision } = await curatorDraft();
    const stranger = await makeUser();

    const res = await app.request(
      `/path-revisions/${revision.id}`,
      jsonAuth(stranger.token, "PATCH", { title: "Hijack" }),
      env
    );

    expect(res.status).toBe(404);
    await expectToMatchSpec(res, "PATCH", "/path-revisions/{id}");
  });
});

describe("POST /path-revisions/{id}/targets", () => {
  it("adds a target and returns the recomputed snapshot", async () => {
    const { curator, revision } = await curatorDraft();
    const target = await createPublishedGuide();

    const res = await app.request(
      `/path-revisions/${revision.id}/targets`,
      jsonAuth(curator.token, "POST", { guide_base_id: target.base.id }),
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "POST", "/path-revisions/{id}/targets");
  });
});

describe("DELETE /path-revisions/{id}/targets/{baseId}", () => {
  it("removes a target and returns the recomputed snapshot", async () => {
    const { curator, revision } = await curatorDraft();
    const target = await createPublishedGuide();
    await addPathNode(revision.id, target.base.id, target.guide.id, {
      is_target: true,
    });

    const res = await app.request(
      `/path-revisions/${revision.id}/targets/${target.base.id}`,
      { method: "DELETE", ...auth(curator.token) },
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(
      res,
      "DELETE",
      "/path-revisions/{id}/targets/{baseId}"
    );
  });
});

describe("PATCH /path-revisions/{id}/nodes/{baseId}", () => {
  it("skips a node in the author's own draft", async () => {
    const { curator, revision } = await curatorDraft();
    const target = await createPublishedGuide();
    await addPathNode(revision.id, target.base.id, target.guide.id, {
      is_target: true,
    });

    const res = await app.request(
      `/path-revisions/${revision.id}/nodes/${target.base.id}`,
      jsonAuth(curator.token, "PATCH", { is_included: false }),
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(
      res,
      "PATCH",
      "/path-revisions/{id}/nodes/{baseId}"
    );
    const body = (await res.json()) as { node: { is_included: boolean } };
    expect(body.node.is_included).toBe(false);
  });

  it("404s for a non-author", async () => {
    const { revision } = await curatorDraft();
    const target = await createPublishedGuide();
    await addPathNode(revision.id, target.base.id, target.guide.id);
    const stranger = await makeUser();

    const res = await app.request(
      `/path-revisions/${revision.id}/nodes/${target.base.id}`,
      jsonAuth(stranger.token, "PATCH", { is_included: false }),
      env
    );

    expect(res.status).toBe(404);
    await expectToMatchSpec(
      res,
      "PATCH",
      "/path-revisions/{id}/nodes/{baseId}"
    );
  });
});

describe("POST /path-revisions/{id}/publish", () => {
  it("401s without a token", async () => {
    const { revision } = await curatorDraft();
    const res = await app.request(
      `/path-revisions/${revision.id}/publish`,
      { method: "POST" },
      env
    );
    expect(res.status).toBe(401);
    await expectToMatchSpec(res, "POST", "/path-revisions/{id}/publish");
  });

  it("publishes the author's own draft", async () => {
    const curator = await makeUser();
    await grantRole(curator.userId, "curator");
    const path = await createLearningPath(curator.userId);
    // Title drives the frozen slug on first publish, so keep it unique.
    const title = `Path ${crypto.randomUUID().slice(0, 8)}`;
    const revision = await createPathRevision(path.id, {
      author_id: curator.userId,
      status: "draft",
      title,
    });
    const target = await createPublishedGuide();
    await addPathNode(revision.id, target.base.id, target.guide.id, {
      is_target: true,
    });

    const res = await app.request(
      `/path-revisions/${revision.id}/publish`,
      { method: "POST", ...auth(curator.token) },
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "POST", "/path-revisions/{id}/publish");
    const body = (await res.json()) as { slug: string };
    expect(body.slug).toBeTruthy();
  });
});

describe("POST /path-revisions/{id}/rollback", () => {
  it("clones an older revision into a new draft", async () => {
    const curator = await makeUser();
    await grantRole(curator.userId, "curator");
    const target = await createPublishedGuide();
    const { revision } = await createPublishedPath(curator.userId, target);

    const res = await app.request(
      `/path-revisions/${revision.id}/rollback`,
      jsonAuth(curator.token, "POST", { revision_id: revision.id }),
      env
    );

    expect(res.status).toBe(201);
    await expectToMatchSpec(res, "POST", "/path-revisions/{id}/rollback");
    const { revision_id } = (await res.json()) as { revision_id: string };
    expect(revision_id).not.toBe(revision.id);
  });

  it("404s when the source revision belongs to another path", async () => {
    const curator = await makeUser();
    await grantRole(curator.userId, "curator");
    const target = await createPublishedGuide();
    const { revision } = await createPublishedPath(curator.userId, target);
    const otherTarget = await createPublishedGuide();
    const other = await createPublishedPath(curator.userId, otherTarget);

    const res = await app.request(
      `/path-revisions/${revision.id}/rollback`,
      jsonAuth(curator.token, "POST", { revision_id: other.revision.id }),
      env
    );

    expect(res.status).toBe(404);
    await expectToMatchSpec(res, "POST", "/path-revisions/{id}/rollback");
  });
});

describe("GET /path-revisions/{id}/diff/{otherId}", () => {
  it("returns the rendered diff between two revisions", async () => {
    const curator = await makeUser();
    await grantRole(curator.userId, "curator");
    const target = await createPublishedGuide();
    const { revision } = await createPublishedPath(curator.userId, target);
    const b = await createPathRevision(revision.learning_path_id, {
      author_id: curator.userId,
      status: "published",
      published_at: new Date().toISOString(),
    });

    const res = await app.request(
      `/path-revisions/${revision.id}/diff/${b.id}`,
      {},
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/path-revisions/{id}/diff/{otherId}");
  });
});
