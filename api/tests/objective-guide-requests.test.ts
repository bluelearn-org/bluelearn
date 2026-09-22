import { describe, expect, it } from "vitest";
import app from "../src/index";
import { admin, auth, env, insert, makeUser } from "./helpers";
import { grantRole } from "./factories/identity";
import {
  createObjective,
  createObjectiveRevision,
  addObjectiveNode,
  createPublishedObjective,
} from "./factories/objectives";
import { createPrerequisite } from "./factories/graph";
import { createPublishedGuide } from "./factories/guides";

const requestRow = {
  title: "Needed prerequisite",
  summary: "Explain the missing prerequisite",
  status: "open" as const,
};

async function expectConstraintFailure<T>(
  promise: Promise<{ error: T | null }>
) {
  const { error } = await promise;
  expect(error).not.toBeNull();
  return error as T & { code?: string };
}

describe("objective guide request schema", () => {
  it("rejects a request with no dependent guide and no objective (requests_has_anchor)", async () => {
    const error = await expectConstraintFailure(
      admin.from("requests").insert(requestRow)
    );
    expect(error.code).toBe("23514");
  });

  it("rejects a guide node that also carries a title (guide_or_request)", async () => {
    const owner = await makeUser();
    const objective = await createObjective(owner.userId);
    const revision = await createObjectiveRevision(objective.id);
    const guide = await createPublishedGuide();

    const error = await expectConstraintFailure(
      admin.from("objective_revision_nodes").insert({
        revision_id: revision.id,
        guide_base_id: guide.base.id,
        guide_id: guide.guide.id,
        title: "Text that belongs only to a request node",
      })
    );
    expect(error.code).toBe("23514");
  });

  it("rejects a request node with a title and no summary (guide_or_request)", async () => {
    const owner = await makeUser();
    const objective = await createObjective(owner.userId);
    const revision = await createObjectiveRevision(objective.id);
    const request = await insert("requests", {
      ...requestRow,
      objective_id: objective.id,
    });

    const error = await expectConstraintFailure(
      admin.from("objective_revision_nodes").insert({
        revision_id: revision.id,
        request_id: request.id,
        title: "A request without its summary",
      })
    );
    expect(error.code).toBe("23514");
  });

  it("resolves an objective-raised request without writing a guide edge", async () => {
    const objective = await createObjective((await makeUser()).userId);
    const request = await insert("requests", {
      ...requestRow,
      objective_id: objective.id,
    });
    const resolver = await createPublishedGuide();

    const { error } = await admin
      .from("requests")
      .update({ status: "resolved", resolved_guide_base_id: resolver.base.id })
      .eq("id", request.id);
    expect(error).toBeNull();

    const { data: resolved } = await admin
      .from("requests")
      .select("status")
      .eq("id", request.id)
      .single()
      .throwOnError();
    expect(resolved.status).toBe("resolved");

    const { data: edges } = await admin
      .from("guide_edges")
      .select("to_guide_base_id")
      .eq("from_guide_base_id", resolver.base.id)
      .throwOnError();
    expect(edges).toEqual([]);
  });

  it("rejects an edge whose to_node sits in another revision (to_is_node)", async () => {
    const owner = await makeUser();
    const objective = await createObjective(owner.userId);
    const first = await createObjectiveRevision(objective.id);
    const second = await createObjectiveRevision(objective.id);
    const from = await createPublishedGuide();
    const to = await createPublishedGuide();
    const firstNode = await addObjectiveNode(
      first.id,
      from.base.id,
      from.guide.id
    );
    const secondNode = await addObjectiveNode(
      second.id,
      to.base.id,
      to.guide.id
    );

    const error = await expectConstraintFailure(
      admin.from("objective_revision_edges").insert({
        revision_id: first.id,
        from_node_id: firstNode.id,
        to_node_id: secondNode.id,
      })
    );
    expect(error.code).toBe("23503");
  });
});

describe("POST /objective-revisions/{id}/publish", () => {
  it("400s a draft whose base is no longer live and keeps the current revision", async () => {
    const curator = await makeUser();
    await grantRole(curator.userId, "curator");
    const target = await createPublishedGuide();
    const { objective } = await createPublishedObjective(
      curator.userId,
      target
    );

    const created = await app.request(
      `/objectives/${objective.slug}/revisions`,
      { method: "POST", ...auth(curator.token) },
      env
    );
    expect(created.status).toBe(201);
    const { revision_id: draftId } = (await created.json()) as {
      revision_id: string;
    };

    const newer = await createObjectiveRevision(objective.id, {
      author_id: curator.userId,
      status: "published",
      title: "Newer live revision",
      published_at: new Date().toISOString(),
    });
    await admin
      .from("objectives")
      .update({ current_revision_id: newer.id })
      .eq("id", objective.id)
      .throwOnError();

    const published = await app.request(
      `/objective-revisions/${draftId}/publish`,
      { method: "POST", ...auth(curator.token) },
      env
    );
    expect(published.status).toBe(400);
    const { data: current } = await admin
      .from("objectives")
      .select("current_revision_id")
      .eq("id", objective.id)
      .single()
      .throwOnError();
    expect(current.current_revision_id).toBe(newer.id);
  });
});

describe("GET /objective-revisions/{id}", () => {
  it("returns projected_edges as guide base ids, not node ids", async () => {
    const curator = await makeUser();
    await grantRole(curator.userId, "curator");
    const from = await createPublishedGuide();
    const to = await createPublishedGuide();
    await createPrerequisite(from.base.id, to.base.id);
    const objective = await createObjective(curator.userId);
    const revision = await createObjectiveRevision(objective.id, {
      author_id: curator.userId,
      status: "draft",
      title: `Frozen edges ${crypto.randomUUID()}`,
    });
    await addObjectiveNode(revision.id, from.base.id, from.guide.id);
    await addObjectiveNode(revision.id, to.base.id, to.guide.id, {
      is_target: true,
    });

    const published = await app.request(
      `/objective-revisions/${revision.id}/publish`,
      { method: "POST", ...auth(curator.token) },
      env
    );
    expect(published.status).toBe(200);

    const snapshotResponse = await app.request(
      `/objective-revisions/${revision.id}`,
      {},
      env
    );
    expect(snapshotResponse.status).toBe(200);
    const body = (await snapshotResponse.json()) as {
      snapshot: {
        projected_edges: Array<{ from_id: string; to_id: string }>;
      };
    };
    expect(body.snapshot.projected_edges).toContainEqual({
      from_id: from.base.id,
      to_id: to.base.id,
    });
  });
});
