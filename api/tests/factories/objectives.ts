import { admin, insert, type Insert } from "../helpers";

export function createObjective(
  createdBy: string,
  overrides: Partial<Insert<"objectives">> = {}
) {
  return insert("objectives", { created_by: createdBy, ...overrides });
}

export function createObjectiveRevision(
  objectiveId: string,
  overrides: Partial<Insert<"objective_revisions">> = {}
) {
  return insert("objective_revisions", {
    objective_id: objectiveId,
    title: "Test Objective",
    ...overrides,
  });
}

export function addObjectiveNode(
  revisionId: string,
  guideBaseId: string,
  guideId: string,
  overrides: Partial<Insert<"objective_revision_nodes">> = {}
) {
  return insert("objective_revision_nodes", {
    revision_id: revisionId,
    guide_base_id: guideBaseId,
    guide_id: guideId,
    ...overrides,
  });
}

// Place a node under a target in the curator's ordering. The featured
// sub-objective is read from these rows, ascending by position.
export function addObjectiveNodeOrder(
  revisionId: string,
  targetNodeId: string,
  nodeId: string,
  position: number
) {
  return insert("objective_revision_node_orders", {
    revision_id: revisionId,
    target_node_id: targetNodeId,
    node_id: nodeId,
    position,
  });
}

// A published objective: slugged shell + published revision + one node with the
// live pointer set.
export async function createPublishedObjective(
  createdBy: string,
  target: { base: { id: string }; guide: { id: string } },
  opts: { title?: string; slug?: string; authorId?: string } = {}
) {
  const objective = await createObjective(createdBy, {
    slug: opts.slug ?? `objective-${crypto.randomUUID()}`,
    status: "published",
  });
  const revision = await createObjectiveRevision(objective.id, {
    title: opts.title ?? "Test Objective",
    status: "published",
    published_at: new Date().toISOString(),
    author_id: opts.authorId ?? createdBy,
  });
  await addObjectiveNode(revision.id, target.base.id, target.guide.id, {
    is_target: true,
  });
  await admin
    .from("objectives")
    .update({ current_revision_id: revision.id })
    .eq("id", objective.id)
    .throwOnError();
  return { objective, revision };
}
