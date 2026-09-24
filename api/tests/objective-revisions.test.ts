import { describe, it, expect } from "vitest";
import app from "../src/index";
import { auth, env, jsonAuth, makeUser } from "./helpers";
import { grantRole } from "./factories/identity";
import { createPublishedGuide } from "./factories/guides";
import { createPrerequisite } from "./factories/graph";
import {
  addObjectiveNode,
  createObjective,
  createObjectiveRevision,
  createPublishedObjective,
} from "./factories/objectives";
import { expectToMatchSpec } from "./openapi";

// A curator with an owned draft objective + draft revision, ready to edit.
async function curatorDraft() {
  const curator = await makeUser();
  await grantRole(curator.userId, "curator");
  const objective = await createObjective(curator.userId); // draft
  const revision = await createObjectiveRevision(objective.id, {
    author_id: curator.userId,
    status: "draft",
  });
  return { curator, objective, revision };
}

describe("GET /objective-revisions/{id}", () => {
  it("returns a published revision's metadata and snapshot", async () => {
    const creator = await makeUser();
    const target = await createPublishedGuide();
    const { revision } = await createPublishedObjective(creator.userId, target);

    const res = await app.request(
      `/objective-revisions/${revision.id}`,
      {},
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/objective-revisions/{id}");
    const body = (await res.json()) as { revision: { id: string } };
    expect(body.revision.id).toBe(revision.id);
  });

  it("404s for an unknown revision", async () => {
    const res = await app.request(
      `/objective-revisions/${crypto.randomUUID()}`,
      {},
      env
    );
    expect(res.status).toBe(404);
    await expectToMatchSpec(res, "GET", "/objective-revisions/{id}");
  });
});

describe("PATCH /objective-revisions/{id}", () => {
  it("edits the author's own draft metadata", async () => {
    const { curator, revision } = await curatorDraft();

    const res = await app.request(
      `/objective-revisions/${revision.id}`,
      jsonAuth(curator.token, "PATCH", { title: "Revised objective" }),
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "PATCH", "/objective-revisions/{id}");
    const body = (await res.json()) as { revision: { title: string } };
    expect(body.revision.title).toBe("Revised objective");
  });

  it("404s for a non-author", async () => {
    const { revision } = await curatorDraft();
    const stranger = await makeUser();

    const res = await app.request(
      `/objective-revisions/${revision.id}`,
      jsonAuth(stranger.token, "PATCH", { title: "Hijack" }),
      env
    );

    expect(res.status).toBe(404);
    await expectToMatchSpec(res, "PATCH", "/objective-revisions/{id}");
  });
});

describe("PATCH /objective-revisions/{id} curation", () => {
  type CurationSnapshot = {
    nodes: Array<{
      id: string;
      guide_base_id: string;
      is_target: boolean;
      is_featured: boolean;
      target_position: number | null;
    }>;
    orders: Array<{
      target_node_id: string;
      node_id: string;
      position: number;
    }>;
  };

  // A draft whose guides were placed by a graph save; the targets are derived
  // from it, and curation names them by node id.
  async function drawnDraft(
    bases: string[],
    edges: Array<[number, number]> = []
  ) {
    const { curator, revision } = await curatorDraft();
    const nodes = bases.map((id) => ({
      id: crypto.randomUUID(),
      guide_base_id: id,
    }));
    const drawn = await app.request(
      `/objective-revisions/${revision.id}`,
      jsonAuth(curator.token, "PATCH", {
        graph: {
          nodes,
          edges: edges.map(([from, to]) => ({
            from_node_id: nodes[from].id,
            to_node_id: nodes[to].id,
          })),
        },
      }),
      env
    );
    expect(drawn.status).toBe(200);

    const curate = (targets: unknown) =>
      app.request(
        `/objective-revisions/${revision.id}`,
        jsonAuth(curator.token, "PATCH", { targets }),
        env
      );
    const read = async () => {
      const res = await app.request(
        `/objective-revisions/${revision.id}`,
        auth(curator.token),
        env
      );
      const { snapshot } = (await res.json()) as { snapshot: CurationSnapshot };
      const byBase = new Map(snapshot.nodes.map((n) => [n.guide_base_id, n]));
      return { snapshot, byBase };
    };
    const nodeIdOf = async (baseId: string) =>
      (await read()).byBase.get(baseId)!.id;

    return { curate, read, nodeIdOf };
  }

  it("orders the targets and records the sequence", async () => {
    const prereq = await createPublishedGuide();
    const goal = await createPublishedGuide();
    const other = await createPublishedGuide();
    await createPrerequisite(prereq.base.id, goal.base.id);
    const { curate, read, nodeIdOf } = await drawnDraft([
      prereq.base.id,
      goal.base.id,
      other.base.id,
    ]);

    const res = await curate([
      {
        node_id: await nodeIdOf(goal.base.id),
        sequence: [prereq.base.id, goal.base.id],
      },
      {
        node_id: await nodeIdOf(other.base.id),
        is_featured: true,
        sequence: [],
      },
    ]);

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "PATCH", "/objective-revisions/{id}");

    const { snapshot: snap, byBase } = await read();
    expect(byBase.get(goal.base.id)?.target_position).toBe(0);
    expect(byBase.get(other.base.id)?.target_position).toBe(1);
    expect(byBase.get(other.base.id)?.is_featured).toBe(true);
    expect(byBase.get(goal.base.id)?.is_featured).toBe(false);

    const goalNodeId = byBase.get(goal.base.id)?.id;
    const sequence = snap.orders
      .filter((o) => o.target_node_id === goalNodeId)
      .sort((a, b) => a.position - b.position)
      .map((o) => o.node_id);
    expect(sequence).toEqual([
      byBase.get(prereq.base.id)?.id,
      byBase.get(goal.base.id)?.id,
    ]);
  });

  it("clears position and featured on an empty curation, not the target", async () => {
    const goal = await createPublishedGuide();
    const { curate, read, nodeIdOf } = await drawnDraft([goal.base.id]);
    const goalNode = await nodeIdOf(goal.base.id);

    expect((await curate([{ node_id: goalNode }])).status).toBe(200);
    expect((await read()).byBase.get(goal.base.id)).toEqual(
      expect.objectContaining({
        is_target: true,
        is_featured: true,
        target_position: 0,
      })
    );

    expect((await curate([])).status).toBe(200);
    expect((await read()).byBase.get(goal.base.id)).toEqual(
      expect.objectContaining({
        is_target: true,
        is_featured: false,
        target_position: null,
      })
    );
  });

  it("400s a node that is not a target of this revision", async () => {
    const before = await createPublishedGuide();
    const goal = await createPublishedGuide();
    const { curate, nodeIdOf } = await drawnDraft(
      [before.base.id, goal.base.id],
      [[0, 1]]
    );

    for (const nodeId of [
      await nodeIdOf(before.base.id),
      crypto.randomUUID(),
    ]) {
      const res = await curate([{ node_id: nodeId }]);
      expect(res.status).toBe(400);
      await expectToMatchSpec(res, "PATCH", "/objective-revisions/{id}");
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("Node is not a target of this revision");
    }

    const accepted = await curate([{ node_id: await nodeIdOf(goal.base.id) }]);
    expect(accepted.status).toBe(200);
  });

  it("403s for a non-curator author", async () => {
    const author = await makeUser();
    const objective = await createObjective(author.userId);
    const revision = await createObjectiveRevision(objective.id, {
      author_id: author.userId,
      status: "draft",
    });

    const res = await app.request(
      `/objective-revisions/${revision.id}`,
      jsonAuth(author.token, "PATCH", {
        targets: [{ node_id: crypto.randomUUID() }],
      }),
      env
    );

    expect(res.status).toBe(403);
    await expectToMatchSpec(res, "PATCH", "/objective-revisions/{id}");
  });
});

describe("PATCH /objective-revisions/{id}/nodes/{baseId}", () => {
  it("skips a node in the author's own draft", async () => {
    const { curator, revision } = await curatorDraft();
    const target = await createPublishedGuide();
    await addObjectiveNode(revision.id, target.base.id, target.guide.id, {
      is_target: true,
    });

    const res = await app.request(
      `/objective-revisions/${revision.id}/nodes/${target.base.id}`,
      jsonAuth(curator.token, "PATCH", { is_included: false }),
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(
      res,
      "PATCH",
      "/objective-revisions/{id}/nodes/{baseId}"
    );
    const body = (await res.json()) as { node: { is_included: boolean } };
    expect(body.node.is_included).toBe(false);
  });

  it("404s for a non-author", async () => {
    const { revision } = await curatorDraft();
    const target = await createPublishedGuide();
    await addObjectiveNode(revision.id, target.base.id, target.guide.id);
    const stranger = await makeUser();

    const res = await app.request(
      `/objective-revisions/${revision.id}/nodes/${target.base.id}`,
      jsonAuth(stranger.token, "PATCH", { is_included: false }),
      env
    );

    expect(res.status).toBe(404);
    await expectToMatchSpec(
      res,
      "PATCH",
      "/objective-revisions/{id}/nodes/{baseId}"
    );
  });
});

describe("POST /objective-revisions/{id}/publish", () => {
  it("401s without a token", async () => {
    const { revision } = await curatorDraft();
    const res = await app.request(
      `/objective-revisions/${revision.id}/publish`,
      { method: "POST" },
      env
    );
    expect(res.status).toBe(401);
    await expectToMatchSpec(res, "POST", "/objective-revisions/{id}/publish");
  });

  it("publishes the author's own draft", async () => {
    const curator = await makeUser();
    await grantRole(curator.userId, "curator");
    const objective = await createObjective(curator.userId);
    // Title drives the frozen slug on first publish, so keep it unique.
    const title = `Objective ${crypto.randomUUID().slice(0, 8)}`;
    const revision = await createObjectiveRevision(objective.id, {
      author_id: curator.userId,
      status: "draft",
      title,
    });
    const target = await createPublishedGuide();
    await addObjectiveNode(revision.id, target.base.id, target.guide.id, {
      is_target: true,
    });

    const res = await app.request(
      `/objective-revisions/${revision.id}/publish`,
      { method: "POST", ...auth(curator.token) },
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "POST", "/objective-revisions/{id}/publish");
    const body = (await res.json()) as { slug: string };
    expect(body.slug).toBeTruthy();
  });
});

describe("POST /objective-revisions/{id}/rollback", () => {
  it("clones an older revision into a new draft", async () => {
    const curator = await makeUser();
    await grantRole(curator.userId, "curator");
    const target = await createPublishedGuide();
    const { revision } = await createPublishedObjective(curator.userId, target);

    const res = await app.request(
      `/objective-revisions/${revision.id}/rollback`,
      jsonAuth(curator.token, "POST", { revision_id: revision.id }),
      env
    );

    expect(res.status).toBe(201);
    await expectToMatchSpec(res, "POST", "/objective-revisions/{id}/rollback");
    const { revision_id } = (await res.json()) as { revision_id: string };
    expect(revision_id).not.toBe(revision.id);
  });

  it("404s when the source revision belongs to another objective", async () => {
    const curator = await makeUser();
    await grantRole(curator.userId, "curator");
    const target = await createPublishedGuide();
    const { revision } = await createPublishedObjective(curator.userId, target);
    const otherTarget = await createPublishedGuide();
    const other = await createPublishedObjective(curator.userId, otherTarget);

    const res = await app.request(
      `/objective-revisions/${revision.id}/rollback`,
      jsonAuth(curator.token, "POST", { revision_id: other.revision.id }),
      env
    );

    expect(res.status).toBe(404);
    await expectToMatchSpec(res, "POST", "/objective-revisions/{id}/rollback");
  });
});

describe("GET /objective-revisions/{id}/diff/{otherId}", () => {
  it("returns the rendered diff between two revisions", async () => {
    const curator = await makeUser();
    await grantRole(curator.userId, "curator");
    const target = await createPublishedGuide();
    const { revision } = await createPublishedObjective(curator.userId, target);
    const b = await createObjectiveRevision(revision.objective_id, {
      author_id: curator.userId,
      status: "published",
      published_at: new Date().toISOString(),
    });

    const res = await app.request(
      `/objective-revisions/${revision.id}/diff/${b.id}`,
      {},
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(
      res,
      "GET",
      "/objective-revisions/{id}/diff/{otherId}"
    );
  });
});
