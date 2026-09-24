import { describe, expect, it } from "vitest";
import app from "../src/index";
import { admin, auth, env, jsonAuth, makeUser } from "./helpers";
import { grantRole } from "./factories/identity";
import { createPublishedGuide } from "./factories/guides";
import { createPrerequisite } from "./factories/graph";
import {
  createObjective,
  createObjectiveRevision,
} from "./factories/objectives";
import { expectToMatchSpec } from "./openapi";

type Snapshot = {
  nodes: Array<{
    id: string;
    guide_base_id: string | null;
    title: string | null;
    summary: string | null;
    request_id: string | null;
    is_target: boolean;
    is_featured: boolean;
    target_position: number | null;
  }>;
  orders: Array<{ target_node_id: string; node_id: string; position: number }>;
  drawn_edges: Array<{ from_node_id: string; to_node_id: string }>;
};

const request = {
  title: "Needed prerequisite",
  summary: "Explain the missing prerequisite",
};

async function curatorDraft() {
  const curator = await makeUser();
  await grantRole(curator.userId, "curator");
  const objective = await createObjective(curator.userId);
  const revision = await createObjectiveRevision(objective.id, {
    author_id: curator.userId,
    status: "draft",
  });
  return { curator, revision };
}

function patch(revisionId: string, token: string, body: unknown) {
  return app.request(
    `/objective-revisions/${revisionId}`,
    jsonAuth(token, "PATCH", body),
    env
  );
}

async function snapshotOf(revisionId: string, token: string) {
  const res = await app.request(
    `/objective-revisions/${revisionId}`,
    auth(token),
    env
  );
  expect(res.status).toBe(200);
  await expectToMatchSpec(res, "GET", "/objective-revisions/{id}");
  const body = (await res.json()) as { snapshot: Snapshot };
  return body.snapshot;
}

// A draft whose goal guide was placed by an earlier graph save, so its node
// already has a server id the client does not know.
async function draftWithTarget() {
  const { curator, revision } = await curatorDraft();
  const goal = await createPublishedGuide();
  const seeded = await patch(revision.id, curator.token, {
    graph: {
      nodes: [{ id: crypto.randomUUID(), guide_base_id: goal.base.id }],
      edges: [],
    },
  });
  expect(seeded.status).toBe(200);
  const [goalNode] = (await snapshotOf(revision.id, curator.token)).nodes;
  return { curator, revision, goal, goalNode };
}

// A guide-only graph body with fresh client ids; each edge is [from, to] as
// indexes into `bases`.
function guideGraph(
  bases: string[],
  edges: Array<[number, number]>
): {
  nodes: Array<{ id: string; guide_base_id: string }>;
  edges: Array<{ from_node_id: string; to_node_id: string }>;
} {
  const nodes = bases.map((id) => ({
    id: crypto.randomUUID(),
    guide_base_id: id,
  }));
  return {
    nodes,
    edges: edges.map(([from, to]) => ({
      from_node_id: nodes[from].id,
      to_node_id: nodes[to].id,
    })),
  };
}

function targetBases(snapshot: Snapshot) {
  return snapshot.nodes
    .filter((n) => n.is_target)
    .map((n) => n.guide_base_id ?? n.id);
}

describe("PATCH /objective-revisions/{id} graph", () => {
  it("stores a request node and its edge under the guide node's server id", async () => {
    const { curator, revision, goal, goalNode } = await draftWithTarget();
    const goalClientId = crypto.randomUUID();
    const requestId = crypto.randomUUID();

    const res = await patch(revision.id, curator.token, {
      graph: {
        nodes: [
          { id: goalClientId, guide_base_id: goal.base.id },
          { id: requestId, ...request },
        ],
        edges: [{ from_node_id: goalClientId, to_node_id: requestId }],
      },
    });
    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "PATCH", "/objective-revisions/{id}");

    const snapshot = await snapshotOf(revision.id, curator.token);
    expect(snapshot.nodes).toContainEqual(
      expect.objectContaining({
        id: requestId,
        guide_base_id: null,
        title: request.title,
        summary: request.summary,
        request_id: null,
      })
    );
    expect(snapshot.drawn_edges).toEqual([
      { from_node_id: goalNode.id, to_node_id: requestId },
    ]);
    expect(snapshot.nodes.map((n) => n.id)).not.toContain(goalClientId);
  });

  it("removes a request node the graph no longer holds, with its edge", async () => {
    const { curator, revision, goal, goalNode } = await draftWithTarget();
    const goalClientId = crypto.randomUUID();
    const requestId = crypto.randomUUID();

    await patch(revision.id, curator.token, {
      graph: {
        nodes: [
          { id: goalClientId, guide_base_id: goal.base.id },
          { id: requestId, ...request },
        ],
        edges: [{ from_node_id: goalClientId, to_node_id: requestId }],
      },
    });
    const res = await patch(revision.id, curator.token, {
      graph: {
        nodes: [{ id: goalClientId, guide_base_id: goal.base.id }],
        edges: [],
      },
    });
    expect(res.status).toBe(200);

    const snapshot = await snapshotOf(revision.id, curator.token);
    expect(snapshot.nodes.map((n) => n.id)).toEqual([goalNode.id]);
    expect(snapshot.drawn_edges).toEqual([]);
  });

  it("keeps the targets' prerequisites through a graph save that omits them", async () => {
    const { curator, revision } = await curatorDraft();
    const prereq = await createPublishedGuide();
    const goal = await createPublishedGuide();
    await createPrerequisite(prereq.base.id, goal.base.id);
    await patch(revision.id, curator.token, {
      graph: guideGraph([prereq.base.id, goal.base.id], []),
    });

    const res = await patch(revision.id, curator.token, {
      graph: guideGraph([goal.base.id], []),
    });
    expect(res.status).toBe(200);

    const snapshot = await snapshotOf(revision.id, curator.token);
    const bases = snapshot.nodes.map((n) => n.guide_base_id);
    expect(bases.sort()).toEqual([goal.base.id, prereq.base.id].sort());
    expect(targetBases(snapshot)).toEqual([goal.base.id]);
  });

  it("makes the end of a drawn edge the only target", async () => {
    const { curator, revision } = await curatorDraft();
    const a = await createPublishedGuide();
    const b = await createPublishedGuide();

    const res = await patch(revision.id, curator.token, {
      graph: guideGraph([a.base.id, b.base.id], [[0, 1]]),
    });
    expect(res.status).toBe(200);

    const snapshot = await snapshotOf(revision.id, curator.token);
    expect(targetBases(snapshot)).toEqual([b.base.id]);
  });

  it("moves the target down a new edge and clears the old one's curation", async () => {
    const { curator, revision } = await curatorDraft();
    const a = await createPublishedGuide();
    const b = await createPublishedGuide();
    const c = await createPublishedGuide();

    await patch(revision.id, curator.token, {
      graph: guideGraph([a.base.id, b.base.id], [[0, 1]]),
    });
    const before = await snapshotOf(revision.id, curator.token);
    const bNode = before.nodes.find((n) => n.guide_base_id === b.base.id)!;
    const curated = await patch(revision.id, curator.token, {
      targets: [
        {
          node_id: bNode.id,
          is_featured: true,
          sequence: [a.base.id, b.base.id],
        },
      ],
    });
    expect(curated.status).toBe(200);
    const curatedSnap = await snapshotOf(revision.id, curator.token);
    expect(curatedSnap.nodes.find((n) => n.id === bNode.id)).toEqual(
      expect.objectContaining({ is_featured: true, target_position: 0 })
    );
    expect(curatedSnap.orders.map((o) => o.target_node_id)).toContain(bNode.id);

    const res = await patch(revision.id, curator.token, {
      graph: guideGraph(
        [a.base.id, b.base.id, c.base.id],
        [
          [0, 1],
          [1, 2],
        ]
      ),
    });
    expect(res.status).toBe(200);

    const after = await snapshotOf(revision.id, curator.token);
    expect(targetBases(after)).toEqual([c.base.id]);
    expect(after.nodes.find((n) => n.id === bNode.id)).toEqual(
      expect.objectContaining({
        is_target: false,
        is_featured: false,
        target_position: null,
      })
    );
    expect(after.orders.filter((o) => o.target_node_id === bNode.id)).toEqual(
      []
    );
  });

  it("makes a request node with no edge out a target", async () => {
    const { curator, revision } = await curatorDraft();
    const guide = await createPublishedGuide();
    const guideId = crypto.randomUUID();
    const requestId = crypto.randomUUID();

    const res = await patch(revision.id, curator.token, {
      graph: {
        nodes: [
          { id: guideId, guide_base_id: guide.base.id },
          { id: requestId, ...request },
        ],
        edges: [{ from_node_id: guideId, to_node_id: requestId }],
      },
    });
    expect(res.status).toBe(200);

    const snapshot = await snapshotOf(revision.id, curator.token);
    expect(targetBases(snapshot)).toEqual([requestId]);
  });

  it("does not make a guide whose prerequisite edge leads to another node a target", async () => {
    const { curator, revision } = await curatorDraft();
    const walkthrough = await createPublishedGuide();
    const goal = await createPublishedGuide();
    await createPrerequisite(walkthrough.base.id, goal.base.id);

    const res = await patch(revision.id, curator.token, {
      graph: guideGraph([walkthrough.base.id, goal.base.id], []),
    });
    expect(res.status).toBe(200);

    const snapshot = await snapshotOf(revision.id, curator.token);
    expect(targetBases(snapshot)).toEqual([goal.base.id]);
  });

  it("400s an edge naming a node outside the graph and writes nothing", async () => {
    const { curator, revision, goal } = await draftWithTarget();
    const goalClientId = crypto.randomUUID();
    const requestId = crypto.randomUUID();
    const nodes = [
      { id: goalClientId, guide_base_id: goal.base.id },
      { id: requestId, ...request },
    ];
    const edge = { from_node_id: goalClientId, to_node_id: requestId };

    const refused = await patch(revision.id, curator.token, {
      graph: {
        nodes,
        edges: [
          edge,
          { from_node_id: crypto.randomUUID(), to_node_id: requestId },
        ],
      },
    });
    expect(refused.status).toBe(400);
    await expectToMatchSpec(refused, "PATCH", "/objective-revisions/{id}");

    const { data: edgeRows } = await admin
      .from("objective_revision_edges")
      .select("from_node_id")
      .eq("revision_id", revision.id)
      .throwOnError();
    expect(edgeRows).toEqual([]);
    const { data: requestRows } = await admin
      .from("objective_revision_nodes")
      .select("id")
      .eq("id", requestId)
      .throwOnError();
    expect(requestRows).toEqual([]);

    const accepted = await patch(revision.id, curator.token, {
      graph: { nodes, edges: [edge] },
    });
    expect(accepted.status).toBe(200);
  });

  it("403s a non-curator author and accepts the same body once they curate", async () => {
    const author = await makeUser();
    const objective = await createObjective(author.userId);
    const revision = await createObjectiveRevision(objective.id, {
      author_id: author.userId,
      status: "draft",
    });
    const body = {
      graph: { nodes: [{ id: crypto.randomUUID(), ...request }], edges: [] },
    };

    const refused = await patch(revision.id, author.token, body);
    expect(refused.status).toBe(403);
    await expectToMatchSpec(refused, "PATCH", "/objective-revisions/{id}");

    await grantRole(author.userId, "curator");
    const accepted = await patch(revision.id, author.token, body);
    expect(accepted.status).toBe(200);
  });
});
