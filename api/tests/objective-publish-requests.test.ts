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
import { buildObjectiveListItems } from "../src/services/objective.service";

type Snapshot = {
  nodes: Array<{
    id: string;
    guide_base_id: string | null;
    title: string | null;
    summary: string | null;
    request_id: string | null;
  }>;
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
    title: `Objective ${crypto.randomUUID().slice(0, 8)}`,
  });
  return { curator, objective, revision };
}

function patch(revisionId: string, token: string, body: unknown) {
  return app.request(
    `/objective-revisions/${revisionId}`,
    jsonAuth(token, "PATCH", body),
    env
  );
}

function publish(revisionId: string, token: string) {
  return app.request(
    `/objective-revisions/${revisionId}/publish`,
    { method: "POST", ...auth(token) },
    env
  );
}

async function rollback(revisionId: string, token: string) {
  const res = await app.request(
    `/objective-revisions/${revisionId}/rollback`,
    jsonAuth(token, "POST", { revision_id: revisionId }),
    env
  );
  expect(res.status).toBe(201);
  const { revision_id } = (await res.json()) as { revision_id: string };
  return revision_id;
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

async function statusOf(revisionId: string) {
  const { data } = await admin
    .from("objective_revisions")
    .select("status")
    .eq("id", revisionId)
    .single()
    .throwOnError();
  return data.status;
}

async function drawnDraft(graph: {
  nodes: Array<Record<string, string>>;
  edges: Array<{ from_node_id: string; to_node_id: string }>;
}) {
  const draft = await curatorDraft();
  const drawn = await patch(draft.revision.id, draft.curator.token, { graph });
  expect(drawn.status).toBe(200);
  return draft;
}

async function draftWithRequest() {
  const goal = await createPublishedGuide();
  const goalId = crypto.randomUUID();
  const requestNodeId = crypto.randomUUID();
  const draft = await drawnDraft({
    nodes: [
      { id: goalId, guide_base_id: goal.base.id },
      { id: requestNodeId, ...request },
    ],
    edges: [{ from_node_id: requestNodeId, to_node_id: goalId }],
  });
  return { ...draft, goal, requestNodeId };
}

async function draftWithGuideEdge() {
  const from = await createPublishedGuide();
  const to = await createPublishedGuide();
  const fromId = crypto.randomUUID();
  const toId = crypto.randomUUID();
  const graph = {
    nodes: [
      { id: fromId, guide_base_id: from.base.id },
      { id: toId, guide_base_id: to.base.id },
    ],
    edges: [{ from_node_id: fromId, to_node_id: toId }],
  };
  return { from, to, graph };
}

describe("POST /objective-revisions/{id}/publish request nodes", () => {
  it("turns a request node into an open request on the objective", async () => {
    const { curator, objective, revision, requestNodeId } =
      await draftWithRequest();

    const res = await publish(revision.id, curator.token);
    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "POST", "/objective-revisions/{id}/publish");

    const { data: requests } = await admin
      .from("requests")
      .select("id, title, summary, status, dependent_guide_base_id")
      .eq("objective_id", objective.id)
      .throwOnError();
    expect(requests).toEqual([
      {
        id: expect.any(String),
        ...request,
        status: "open",
        dependent_guide_base_id: null,
      },
    ]);

    const snapshot = await snapshotOf(revision.id, curator.token);
    const node = snapshot.nodes.find((n) => n.id === requestNodeId);
    expect(node?.request_id).toBe(requests[0].id);
    const goalNode = snapshot.nodes.find((n) => n.guide_base_id !== null);
    expect(snapshot.drawn_edges).toContainEqual({
      from_node_id: requestNodeId,
      to_node_id: goalNode?.id,
    });
  });

  it("writes a drawn guide edge into the guide graph", async () => {
    const { from, to, graph } = await draftWithGuideEdge();
    const { curator, revision } = await drawnDraft(graph);

    const res = await publish(revision.id, curator.token);
    expect(res.status).toBe(200);

    const { data: edges } = await admin
      .from("guide_edges")
      .select("to_guide_base_id, edge_type")
      .eq("from_guide_base_id", from.base.id)
      .throwOnError();
    expect(edges).toEqual([
      { to_guide_base_id: to.base.id, edge_type: "prerequisite" },
    ]);
  });

  it("409s a drawn guide edge that closes a cycle and keeps the draft", async () => {
    const { from, to, graph } = await draftWithGuideEdge();
    await createPrerequisite(to.base.id, from.base.id);
    // without an endpoint past the cycle there is no target, and publish 400s first
    const end = await createPublishedGuide();
    const endId = crypto.randomUUID();
    const toId = graph.edges[0].to_node_id;
    const { curator, revision } = await drawnDraft({
      nodes: [...graph.nodes, { id: endId, guide_base_id: end.base.id }],
      edges: [...graph.edges, { from_node_id: toId, to_node_id: endId }],
    });

    const res = await publish(revision.id, curator.token);
    expect(res.status).toBe(409);
    expect(await statusOf(revision.id)).toBe("draft");
  });

  it("still 409s a draft whose base is no longer live", async () => {
    const { curator, revision } = await draftWithRequest();
    expect((await publish(revision.id, curator.token)).status).toBe(200);
    const first = await rollback(revision.id, curator.token);
    const second = await rollback(revision.id, curator.token);
    expect((await publish(first, curator.token)).status).toBe(200);

    const res = await publish(second, curator.token);
    expect(res.status).toBe(409);
  });

  it("400s a titled draft with no target and keeps the draft", async () => {
    const { curator, revision } = await curatorDraft();
    const goal = await createPublishedGuide();

    const res = await publish(revision.id, curator.token);
    expect(res.status).toBe(400);
    expect(await statusOf(revision.id)).toBe("draft");

    const seeded = await patch(revision.id, curator.token, {
      graph: {
        nodes: [{ id: crypto.randomUUID(), guide_base_id: goal.base.id }],
        edges: [],
      },
    });
    expect(seeded.status).toBe(200);
    expect((await publish(revision.id, curator.token)).status).toBe(200);
    expect(await statusOf(revision.id)).toBe("published");
  });
});

describe("POST /objective-revisions/{id}/rollback request nodes", () => {
  it("keeps the request node, its request, and its drawn edge", async () => {
    const { curator, revision, goal, requestNodeId } = await draftWithRequest();
    expect((await publish(revision.id, curator.token)).status).toBe(200);
    const published = await snapshotOf(revision.id, curator.token);
    const source = published.nodes.find((n) => n.id === requestNodeId);

    const draftId = await rollback(revision.id, curator.token);

    const snapshot = await snapshotOf(draftId, curator.token);
    const requestNode = snapshot.nodes.find((n) => n.guide_base_id === null);
    const goalNode = snapshot.nodes.find(
      (n) => n.guide_base_id === goal.base.id
    );
    expect(requestNode).toEqual(
      expect.objectContaining({
        title: request.title,
        summary: request.summary,
        request_id: source?.request_id,
      })
    );
    expect(requestNode?.id).not.toBe(requestNodeId);
    expect(snapshot.drawn_edges).toEqual([
      { from_node_id: requestNode?.id, to_node_id: goalNode?.id },
    ]);
  });
});

async function resolveRequest(requestId: string, resolvedBaseId: string) {
  await admin
    .from("requests")
    .update({ status: "resolved", resolved_guide_base_id: resolvedBaseId })
    .eq("id", requestId)
    .throwOnError();
}

async function edgesFrom(baseId: string) {
  const { data } = await admin
    .from("guide_edges")
    .select("to_guide_base_id")
    .eq("from_guide_base_id", baseId)
    .throwOnError();
  return data.map((e) => e.to_guide_base_id);
}

async function requestIdOf(revisionId: string, nodeId: string, token: string) {
  const snapshot = await snapshotOf(revisionId, token);
  const node = snapshot.nodes.find((n) => n.id === nodeId);
  expect(node?.request_id).toEqual(expect.any(String));
  return node!.request_id!;
}

describe("resolving an objective-raised request", () => {
  it("writes its drawn edges into the guide graph", async () => {
    const before = await createPublishedGuide();
    const goal = await createPublishedGuide();
    const beforeId = crypto.randomUUID();
    const requestNodeId = crypto.randomUUID();
    const goalId = crypto.randomUUID();
    const { curator, revision } = await drawnDraft({
      nodes: [
        { id: beforeId, guide_base_id: before.base.id },
        { id: requestNodeId, ...request },
        { id: goalId, guide_base_id: goal.base.id },
      ],
      edges: [
        { from_node_id: beforeId, to_node_id: requestNodeId },
        { from_node_id: requestNodeId, to_node_id: goalId },
      ],
    });
    expect((await publish(revision.id, curator.token)).status).toBe(200);
    const requestId = await requestIdOf(
      revision.id,
      requestNodeId,
      curator.token
    );

    const resolved = await createPublishedGuide();
    await resolveRequest(requestId, resolved.base.id);

    expect(await edgesFrom(before.base.id)).toEqual([resolved.base.id]);
    expect(await edgesFrom(resolved.base.id)).toEqual([goal.base.id]);
  });

  it("waits for the other end of a request-to-request edge", async () => {
    const goal = await createPublishedGuide();
    const firstId = crypto.randomUUID();
    const secondId = crypto.randomUUID();
    const goalId = crypto.randomUUID();
    const { curator, revision } = await drawnDraft({
      nodes: [
        { id: firstId, title: "First request", summary: "Comes first" },
        { id: secondId, title: "Second request", summary: "Comes second" },
        { id: goalId, guide_base_id: goal.base.id },
      ],
      edges: [
        { from_node_id: firstId, to_node_id: secondId },
        { from_node_id: secondId, to_node_id: goalId },
      ],
    });
    expect((await publish(revision.id, curator.token)).status).toBe(200);
    const firstRequest = await requestIdOf(revision.id, firstId, curator.token);
    const secondRequest = await requestIdOf(
      revision.id,
      secondId,
      curator.token
    );

    const first = await createPublishedGuide();
    await resolveRequest(firstRequest, first.base.id);
    expect(await edgesFrom(first.base.id)).toEqual([]);

    const second = await createPublishedGuide();
    await resolveRequest(secondRequest, second.base.id);
    expect(await edgesFrom(first.base.id)).toEqual([second.base.id]);
    expect(await edgesFrom(second.base.id)).toEqual([goal.base.id]);
  });
});

describe("published objective cards", () => {
  it("keeps request titles beside guide titles in the featured sequence", async () => {
    const guide = await createPublishedGuide({ title: "Existing foundation" });

    const guideId = crypto.randomUUID();
    const requestId = crypto.randomUUID();
    const targetId = crypto.randomUUID();
    const { curator, objective, revision } = await drawnDraft({
      nodes: [
        { id: guideId, guide_base_id: guide.base.id },
        { id: requestId, title: "Requested practice", summary: "Practice it" },
        { id: targetId, title: "Requested goal", summary: "Complete it" },
      ],
      edges: [
        { from_node_id: guideId, to_node_id: requestId },
        { from_node_id: requestId, to_node_id: targetId },
      ],
    });

    const curated = await patch(revision.id, curator.token, {
      targets: [
        {
          node_id: targetId,
          is_featured: true,
          sequence: [guideId, requestId],
        },
      ],
    });
    expect(curated.status).toBe(200);
    expect((await publish(revision.id, curator.token)).status).toBe(200);

    const { data: row } = await admin
      .from("objectives")
      .select(
        "id, slug, created_by, created_at, current_revision_id, current:objective_revisions!objectives_current_revision_id_fkey(title, summary)"
      )
      .eq("id", objective.id)
      .single()
      .throwOnError();

    const [card] = await buildObjectiveListItems(admin, [row]);

    expect(card.featured_sub_objective).toEqual([
      { position: 1, slug: guide.base.slug, title: "Existing foundation" },
      { position: 2, slug: null, title: "Requested practice" },
      { position: 3, slug: null, title: "Requested goal" },
    ]);
    expect(card.guides_total).toBe(3);
  });
});

describe("published objective prerequisite projection", () => {
  it.each([false, true])(
    "bridges an omitted guide when request nodes are present: %s",
    async (withRequest) => {
      const first = await createPublishedGuide();
      const skipped = await createPublishedGuide();
      const last = await createPublishedGuide();
      await createPrerequisite(first.base.id, skipped.base.id);
      await createPrerequisite(skipped.base.id, last.base.id);

      const firstId = crypto.randomUUID();
      const lastId = crypto.randomUUID();
      const requestId = crypto.randomUUID();
      const nodes: Array<Record<string, string>> = [
        { id: firstId, guide_base_id: first.base.id },
        { id: lastId, guide_base_id: last.base.id },
      ];
      if (withRequest) {
        nodes.push({ id: requestId, ...request });
      }

      const { curator, revision } = await drawnDraft({
        nodes,
        edges: withRequest
          ? [{ from_node_id: lastId, to_node_id: requestId }]
          : [],
      });

      expect((await publish(revision.id, curator.token)).status).toBe(200);
      const snapshot = await snapshotOf(revision.id, curator.token);

      expect(snapshot.drawn_edges).toContainEqual({
        from_node_id: firstId,
        to_node_id: lastId,
      });
      expect(snapshot.nodes.map((node) => node.guide_base_id)).not.toContain(
        skipped.base.id
      );
    }
  );
});
