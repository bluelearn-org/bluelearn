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

async function drawnDraft(
  targetBaseId: string,
  graph: {
    nodes: Array<Record<string, string>>;
    edges: Array<{ from_node_id: string; to_node_id: string }>;
  }
) {
  const draft = await curatorDraft();
  const seeded = await patch(draft.revision.id, draft.curator.token, {
    targets: [{ guide_base_id: targetBaseId }],
  });
  expect(seeded.status).toBe(200);
  const drawn = await patch(draft.revision.id, draft.curator.token, { graph });
  expect(drawn.status).toBe(200);
  return draft;
}

async function draftWithRequest() {
  const goal = await createPublishedGuide();
  const goalId = crypto.randomUUID();
  const requestNodeId = crypto.randomUUID();
  const draft = await drawnDraft(goal.base.id, {
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
    const { curator, revision } = await drawnDraft(to.base.id, graph);

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
    const { curator, revision } = await drawnDraft(to.base.id, graph);

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
