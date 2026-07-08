import { describe, it, expect } from "vitest";
import app from "../src/index";
import { auth, env, jsonAuth, makeUser } from "./helpers";
import { grantRole } from "./factories/identity";
import { createPublishedGuide } from "./factories/guides";
import {
  createLearningPath,
  createPublishedPath,
} from "./factories/learning-paths";
import { expectToMatchSpec } from "./openapi";

describe("GET /paths", () => {
  it("lists published paths and omits drafts", async () => {
    const creator = await makeUser();
    const target = await createPublishedGuide();
    const published = await createPublishedPath(creator.userId, target);
    const draft = await createLearningPath(creator.userId); // defaults to draft

    const res = await app.request("/paths", {}, env);

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/paths");
    const body = (await res.json()) as {
      learning_paths: Array<{ id: string }>;
    };
    const ids = body.learning_paths.map((p) => p.id);
    expect(ids).toContain(published.path.id);
    expect(ids).not.toContain(draft.id);
  });
});

describe("POST /paths", () => {
  it("401s without a token", async () => {
    const res = await app.request("/paths", { method: "POST" }, env);
    expect(res.status).toBe(401);
    await expectToMatchSpec(res, "POST", "/paths");
  });

  it("creates a draft path for a curator", async () => {
    const curator = await makeUser();
    await grantRole(curator.userId, "curator");
    const target = await createPublishedGuide();

    const res = await app.request(
      "/paths",
      jsonAuth(curator.token, "POST", {
        title: `Path ${crypto.randomUUID().slice(0, 8)}`,
        target_ids: [target.base.id],
      }),
      env
    );

    expect(res.status).toBe(201);
    await expectToMatchSpec(res, "POST", "/paths");
    const { revision_id } = (await res.json()) as { revision_id: string };
    expect(revision_id).toBeTruthy();
  });

  it("403s for a non-curator", async () => {
    const user = await makeUser();
    const target = await createPublishedGuide();

    const res = await app.request(
      "/paths",
      jsonAuth(user.token, "POST", { target_ids: [target.base.id] }),
      env
    );

    expect(res.status).toBe(403);
    await expectToMatchSpec(res, "POST", "/paths");
  });
});

describe("GET /paths/{slug}", () => {
  it("returns the path and its live snapshot", async () => {
    const creator = await makeUser();
    const target = await createPublishedGuide();
    const { path } = await createPublishedPath(creator.userId, target);

    const res = await app.request(`/paths/${path.slug}`, {}, env);

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/paths/{slug}");
    const body = (await res.json()) as {
      path: { id: string };
      snapshot: { nodes: Array<{ guide_base_id: string }> };
    };
    expect(body.path.id).toBe(path.id);
    expect(body.snapshot.nodes.map((n) => n.guide_base_id)).toContain(
      target.base.id
    );
  });

  it("404s for an unknown path", async () => {
    const res = await app.request(
      `/paths/nope-${crypto.randomUUID()}`,
      {},
      env
    );
    expect(res.status).toBe(404);
    await expectToMatchSpec(res, "GET", "/paths/{slug}");
  });
});

describe("DELETE /paths/{slug}", () => {
  it("archives the owner-curator's own path", async () => {
    const curator = await makeUser();
    await grantRole(curator.userId, "curator");
    const target = await createPublishedGuide();
    const { path } = await createPublishedPath(curator.userId, target);

    const res = await app.request(
      `/paths/${path.slug}`,
      { method: "DELETE", ...auth(curator.token) },
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "DELETE", "/paths/{slug}");
    const body = (await res.json()) as { path: { status: string } };
    expect(body.path.status).toBe("archived");
  });

  it("404s for a stranger", async () => {
    const curator = await makeUser();
    await grantRole(curator.userId, "curator");
    const target = await createPublishedGuide();
    const { path } = await createPublishedPath(curator.userId, target);

    const stranger = await makeUser();
    const res = await app.request(
      `/paths/${path.slug}`,
      { method: "DELETE", ...auth(stranger.token) },
      env
    );

    expect(res.status).toBe(404);
    await expectToMatchSpec(res, "DELETE", "/paths/{slug}");
  });
});

describe("GET /paths/{slug}/revisions", () => {
  it("lists the path's revision history", async () => {
    const creator = await makeUser();
    const target = await createPublishedGuide();
    const { path, revision } = await createPublishedPath(
      creator.userId,
      target
    );

    const res = await app.request(`/paths/${path.slug}/revisions`, {}, env);

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/paths/{slug}/revisions");
    const body = (await res.json()) as { revisions: Array<{ id: string }> };
    expect(body.revisions.map((r) => r.id)).toContain(revision.id);
  });
});

describe("POST /paths/{slug}/revisions", () => {
  // Contract-first: this endpoint is a 501 stub. Asserts the documented 201
  // shape and stays red until the new-draft flow is implemented.
  it("opens a new draft revision", async () => {
    const curator = await makeUser();
    await grantRole(curator.userId, "curator");
    const target = await createPublishedGuide();
    const { path } = await createPublishedPath(curator.userId, target);

    const res = await app.request(
      `/paths/${path.slug}/revisions`,
      { method: "POST", ...auth(curator.token) },
      env
    );

    expect(res.status).toBe(201);
    await expectToMatchSpec(res, "POST", "/paths/{slug}/revisions");
  });
});
