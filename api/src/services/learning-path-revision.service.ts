import type { SupabaseClient } from "@supabase/supabase-js"
import type { UpdatePathNodeInput, UpdatePathRevisionInput } from "@bluelearn/schemas"
import type { Database } from "../database.types"
import { ServiceError } from "../lib/service-error"

type DB = SupabaseClient<Database>

const REVISION_META =
  "id, title, summary, change_summary, status, created_at, published_at, updated_at"

const NODE_COLS = "guide_base_id, guide_id, is_target, is_included, note"

// All of a revision's nodes (included or skipped) plus the projected edges (the
// bridged projection over included nodes) and the raw prerequisite edges among
// every node, read live from the guide graph.
export async function getRevisionSnapshot(
  supabase: DB,
  revisionId: string,
  projectedSource: "frozen" | "live" = "frozen",
) {
  const { data: nodeRows, error: nodeError } = await supabase
    .from("learning_path_revision_nodes")
    .select(NODE_COLS)
    .eq("revision_id", revisionId)

  if (nodeError) {
    console.error(nodeError)
    throw new ServiceError("Failed to load revision", 500)
  }

  const baseIds = (nodeRows ?? []).map((n) => n.guide_base_id)
  const baseMeta = new Map<string, { slug: string | null; title: string | null }>()

  if (baseIds.length > 0) {
    const { data: bases, error: baseError } = await supabase
      .from("guide_bases")
      .select("id, slug, title")
      .in("id", baseIds)

    if (baseError) {
      console.error(baseError)
      throw new ServiceError("Failed to load revision", 500)
    }
    for (const b of bases ?? []) baseMeta.set(b.id, { slug: b.slug, title: b.title })
  }

  const nodes = (nodeRows ?? []).map((n) => ({
    guide_base_id: n.guide_base_id,
    guide_id: n.guide_id,
    slug: baseMeta.get(n.guide_base_id)?.slug ?? null,
    title: baseMeta.get(n.guide_base_id)?.title ?? null,
    is_target: n.is_target,
    is_included: n.is_included,
    note: n.note,
  }))

  const projectedQuery =
    projectedSource === "live"
      ? supabase.rpc("project_path_edges", { p_revision_id: revisionId })
      : supabase
        .from("learning_path_revision_edges")
        .select("from_guide_base_id, to_guide_base_id")
        .eq("revision_id", revisionId)

  const [projected, raw] = await Promise.all([
    projectedQuery,
    baseIds.length > 0
      ? supabase
        .from("guide_edges")
        .select("from_guide_base_id, to_guide_base_id")
        .eq("edge_type", "prerequisite")
        .eq("is_suspended", false)
        .in("from_guide_base_id", baseIds)
        .in("to_guide_base_id", baseIds)
      : null,
  ])

  if (projected.error) {
    console.error(projected.error)
    throw new ServiceError("Failed to load revision edges", 500)
  }
  if (raw?.error) {
    console.error(raw.error)
    throw new ServiceError("Failed to load revision edges", 500)
  }

  const toEdge = (e: { from_guide_base_id: string; to_guide_base_id: string }) => ({
    from_id: e.from_guide_base_id,
    to_id: e.to_guide_base_id,
  })

  const projected_edges = (projected.data ?? []).map(toEdge)
  const raw_edges = (raw?.data ?? []).map(toEdge)

  return { nodes, projected_edges, raw_edges }
}

export async function getLearningPathRevision(supabase: DB, revisionId: string) {
  const { data: revision, error } = await supabase
    .from("learning_path_revisions")
    .select(REVISION_META)
    .eq("id", revisionId)
    .maybeSingle()

  if (error) {
    console.error(error)
    throw new ServiceError("Failed to load revision", 500)
  }
  if (!revision) throw new ServiceError("Revision not found", 404)

  const snapshot = await getRevisionSnapshot(
    supabase,
    revisionId,
    revision.status === "published" ? "frozen" : "live",
  )
  return { revision, snapshot }
}

// Overwrite a draft revision's metadata.
export async function updateLearningPathRevision(
  supabase: DB,
  revisionId: string,
  input: UpdatePathRevisionInput,
) {
  const { data, error } = await supabase
    .from("learning_path_revisions")
    .update(input)
    .eq("id", revisionId)
    .select(REVISION_META)

  if (error) throw new ServiceError("Unable to update revision", 400)
  if (!data || data.length === 0) {
    throw new ServiceError("Revision not found or not an editable draft", 404)
  }
  return { revision: data[0] }
}

// Edit one node of a draft revision: swap the pinned variant, toggle target/skip,
// or set a note.
export async function updatePathNode(
  supabase: DB,
  revisionId: string,
  baseId: string,
  input: UpdatePathNodeInput,
) {
  const { data, error } = await supabase
    .from("learning_path_revision_nodes")
    .update(input)
    .eq("revision_id", revisionId)
    .eq("guide_base_id", baseId)
    .select(NODE_COLS)

  if (error) throw new ServiceError("Unable to update node", 400)
  if (!data || data.length === 0) {
    throw new ServiceError("Node not found or not editable", 404)
  }
  const node = data[0]

  const { data: base, error: baseError } = await supabase
    .from("guide_bases")
    .select("slug, title")
    .eq("id", node.guide_base_id)
    .maybeSingle()

  if (baseError) {
    console.error(baseError)
    throw new ServiceError("Failed to load guide", 500)
  }

  return {
    node: {
      guide_base_id: node.guide_base_id,
      guide_id: node.guide_id,
      slug: base?.slug ?? null,
      title: base?.title ?? null,
      is_target: node.is_target,
      is_included: node.is_included,
      note: node.note,
    },
  }
}

// Publish the draft directly (no review gate): freeze its edge projection, point
// the path at it, and freeze the slug on first publish in one transaction via the
// publish_learning_path_revision RPC. Returns the live slug for routing.
export async function publishLearningPathRevision(supabase: DB, revisionId: string) {
  const { data: slug, error } = await supabase.rpc("publish_learning_path_revision", {
    p_revision_id: revisionId,
  })

  if (error) {
    if (error.code === "P0002") throw new ServiceError("Revision not found", 404)
    if (error.code === "42501") throw new ServiceError("Not permitted to publish this revision", 403)
    throw new ServiceError("Unable to publish revision", 400)
  }
  return { slug }
}

// Roll an older revision forward as a new draft: clone its nodes into a fresh
// draft on the same path in one transaction via the rollback_learning_path_revision
// RPC. Edges are not copied; a draft projects them live and freezes them only at
// publish. Returns the draft revision id, so the client routes to its editor.
export async function rollbackLearningPathRevision(
  supabase: DB,
  revisionId: string,
  sourceRevisionId: string,
) {
  const { data: revision_id, error } = await supabase.rpc("rollback_learning_path_revision", {
    p_revision_id: revisionId,
    p_source_revision_id: sourceRevisionId,
  })

  if (error) {
    if (error.code === "P0002") throw new ServiceError("Revision not found for this path", 404)
    if (error.code === "42501") throw new ServiceError("Not permitted to roll back this revision", 403)
    throw new ServiceError("Unable to roll back revision", 400)
  }

  return { revision_id }
}
