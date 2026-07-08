import { admin, insert, type Insert } from "../helpers";

export function createLearningPath(
  createdBy: string,
  overrides: Partial<Insert<"learning_paths">> = {}
) {
  return insert("learning_paths", { created_by: createdBy, ...overrides });
}

export function createPathRevision(
  learningPathId: string,
  overrides: Partial<Insert<"learning_path_revisions">> = {}
) {
  return insert("learning_path_revisions", {
    learning_path_id: learningPathId,
    title: "Test Path",
    ...overrides,
  });
}

export function addPathNode(
  revisionId: string,
  guideBaseId: string,
  guideId: string,
  overrides: Partial<Insert<"learning_path_revision_nodes">> = {}
) {
  return insert("learning_path_revision_nodes", {
    revision_id: revisionId,
    guide_base_id: guideBaseId,
    guide_id: guideId,
    ...overrides,
  });
}

// A published path: slugged shell + published revision + one node with the
// live pointer set.
export async function createPublishedPath(
  createdBy: string,
  target: { base: { id: string }; guide: { id: string } },
  opts: { title?: string; slug?: string; authorId?: string } = {}
) {
  const path = await createLearningPath(createdBy, {
    slug: opts.slug ?? `path-${crypto.randomUUID()}`,
    status: "published",
  });
  const revision = await createPathRevision(path.id, {
    title: opts.title ?? "Test Path",
    status: "published",
    published_at: new Date().toISOString(),
    author_id: opts.authorId ?? createdBy,
  });
  await addPathNode(revision.id, target.base.id, target.guide.id, {
    is_target: true,
  });
  await admin
    .from("learning_paths")
    .update({ current_revision_id: revision.id })
    .eq("id", path.id)
    .throwOnError();
  return { path, revision };
}
