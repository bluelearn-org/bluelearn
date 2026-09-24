import { describe, it, expect } from "vitest";
import app from "../src/index";
import { auth, env, jsonAuth, makeUser } from "./helpers";
import { grantRole } from "./factories/identity";
import { createPublishedGuide } from "./factories/guides";
import {
  createObjective,
  createPublishedObjective,
} from "./factories/objectives";
import { expectToMatchSpec } from "./openapi";

describe("GET /objectives", () => {
  it("lists published objectives and omits drafts", async () => {
    const creator = await makeUser();
    const target = await createPublishedGuide();
    const published = await createPublishedObjective(creator.userId, target);
    const draft = await createObjective(creator.userId); // defaults to draft

    const res = await app.request("/objectives", {}, env);

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/objectives");
    const body = (await res.json()) as {
      objectives: Array<{ id: string }>;
    };
    const ids = body.objectives.map((p) => p.id);
    expect(ids).toContain(published.objective.id);
    expect(ids).not.toContain(draft.id);
  });
});

describe("POST /objectives", () => {
  it("401s without a token", async () => {
    const res = await app.request("/objectives", { method: "POST" }, env);
    expect(res.status).toBe(401);
    await expectToMatchSpec(res, "POST", "/objectives");
  });

  it("creates a draft objective for a curator", async () => {
    const curator = await makeUser();
    await grantRole(curator.userId, "curator");

    const res = await app.request(
      "/objectives",
      jsonAuth(curator.token, "POST", {
        title: `Objective ${crypto.randomUUID().slice(0, 8)}`,
      }),
      env
    );

    expect(res.status).toBe(201);
    await expectToMatchSpec(res, "POST", "/objectives");
    const { revision_id } = (await res.json()) as { revision_id: string };
    expect(revision_id).toBeTruthy();
  });

  it("creates a draft with no target", async () => {
    const curator = await makeUser();
    await grantRole(curator.userId, "curator");

    const targetsOf = async () => {
      const created = await app.request(
        "/objectives",
        jsonAuth(curator.token, "POST", {}),
        env
      );
      expect(created.status).toBe(201);
      const { revision_id } = (await created.json()) as {
        revision_id: string;
      };
      const res = await app.request(
        `/objective-revisions/${revision_id}`,
        auth(curator.token),
        env
      );
      const { snapshot } = (await res.json()) as {
        snapshot: {
          nodes: Array<{ guide_base_id: string; is_target: boolean }>;
        };
      };
      return snapshot.nodes
        .filter((n) => n.is_target)
        .map((n) => n.guide_base_id);
    };

    expect(await targetsOf()).toEqual([]);
  });

  it("403s for a non-curator", async () => {
    const user = await makeUser();

    const res = await app.request(
      "/objectives",
      jsonAuth(user.token, "POST", {}),
      env
    );

    expect(res.status).toBe(403);
    await expectToMatchSpec(res, "POST", "/objectives");
  });
});

describe("GET /objectives/{slug}", () => {
  it("returns the objective and its live snapshot", async () => {
    const creator = await makeUser();
    const target = await createPublishedGuide();
    const { objective } = await createPublishedObjective(
      creator.userId,
      target
    );

    const res = await app.request(`/objectives/${objective.slug}`, {}, env);

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/objectives/{slug}");
    const body = (await res.json()) as {
      objective: { id: string };
      snapshot: { nodes: Array<{ guide_base_id: string }> };
    };
    expect(body.objective.id).toBe(objective.id);
    expect(body.snapshot.nodes.map((n) => n.guide_base_id)).toContain(
      target.base.id
    );
  });

  it("404s for an unknown objective", async () => {
    const res = await app.request(
      `/objectives/nope-${crypto.randomUUID()}`,
      {},
      env
    );
    expect(res.status).toBe(404);
    await expectToMatchSpec(res, "GET", "/objectives/{slug}");
  });
});

describe("DELETE /objectives/{slug}", () => {
  it("archives the owner-curator's own objective", async () => {
    const curator = await makeUser();
    await grantRole(curator.userId, "curator");
    const target = await createPublishedGuide();
    const { objective } = await createPublishedObjective(
      curator.userId,
      target
    );

    const res = await app.request(
      `/objectives/${objective.slug}`,
      { method: "DELETE", ...auth(curator.token) },
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "DELETE", "/objectives/{slug}");
    const body = (await res.json()) as { objective: { status: string } };
    expect(body.objective.status).toBe("archived");
  });

  it("404s for a stranger", async () => {
    const curator = await makeUser();
    await grantRole(curator.userId, "curator");
    const target = await createPublishedGuide();
    const { objective } = await createPublishedObjective(
      curator.userId,
      target
    );

    const stranger = await makeUser();
    const res = await app.request(
      `/objectives/${objective.slug}`,
      { method: "DELETE", ...auth(stranger.token) },
      env
    );

    expect(res.status).toBe(404);
    await expectToMatchSpec(res, "DELETE", "/objectives/{slug}");
  });
});

describe("GET /objectives/{slug}/revisions", () => {
  it("lists the objective's revision history", async () => {
    const creator = await makeUser();
    const target = await createPublishedGuide();
    const { objective, revision } = await createPublishedObjective(
      creator.userId,
      target
    );

    const res = await app.request(
      `/objectives/${objective.slug}/revisions`,
      {},
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/objectives/{slug}/revisions");
    const body = (await res.json()) as { revisions: Array<{ id: string }> };
    expect(body.revisions.map((r) => r.id)).toContain(revision.id);
  });
});

describe("POST /objectives/{slug}/revisions", () => {
  it("opens a new draft revision", async () => {
    const curator = await makeUser();
    await grantRole(curator.userId, "curator");
    const target = await createPublishedGuide();
    const { objective } = await createPublishedObjective(
      curator.userId,
      target
    );

    const res = await app.request(
      `/objectives/${objective.slug}/revisions`,
      { method: "POST", ...auth(curator.token) },
      env
    );

    expect(res.status).toBe(201);
    await expectToMatchSpec(res, "POST", "/objectives/{slug}/revisions");
  });
});
