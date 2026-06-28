import type { SupabaseClient } from "@supabase/supabase-js"
import type { CreateLearningPathInput } from "@bluelearn/schemas"
import type { Database } from "../database.types"
import { ServiceError } from "../lib/service-error"
import { getRevisionSnapshot } from "./learning-path-revision.service"

type DB = SupabaseClient<Database>

// This embed walks learning_paths -> current revision through the live pointer FK.
const CURRENT_META = `
  current:learning_path_revisions!learning_paths_current_revision_id_fkey(
    title,
    summary
  )
`

// Resolve a path slug to its id + live revision, or 404. RLS hides drafts, so an
// unseen path reads as missing. A published path always carries a slug and a
// current_revision_id, so this only resolves live paths.
async function resolvePath(supabase: DB, rawSlug: string) {
  const { data, error } = await supabase
    .from("learning_paths")
    .select("id, current_revision_id")
    .eq("slug", rawSlug.toLowerCase())
    .maybeSingle()

  if (error) {
    console.error(error)
    throw new ServiceError("Failed to load learning path", 500)
  }
  if (!data) throw new ServiceError("Learning path not found", 404)
  return data
}

// List published paths, newest first. RLS hides drafts from non-authors.
export async function listPublishedLearningPaths(supabase: DB) {
  const { data, error } = await supabase
    .from("learning_paths")
    .select(`id, slug, created_at, ${CURRENT_META}`)
    .eq("status", "published")
    .order("created_at", { ascending: false })

  if (error) {
    console.error(error)
    throw new ServiceError("Failed to load learning paths", 500)
  }

  return (data ?? []).map(({ current, ...path }) => ({
    ...path,
    title: current?.title ?? null,
    summary: current?.summary ?? null,
  }))
}

// Create a path: bundles the path shell + revision 1 + the targets' prerequisite
// closure as the initial node set in one transaction via the create_learning_path
// RPC (RLS still applies, SECURITY INVOKER). Returns the draft revision id so the
// client routes straight to its editor.
export async function createLearningPath(supabase: DB, input: CreateLearningPathInput) {
  const { data: revision_id, error } = await supabase.rpc("create_learning_path", {
    p_targets: input.target_ids,
    p_title: input.title ?? undefined,
    p_summary: input.summary ?? undefined,
  })

  if (error) {
    console.error(error)
    throw new ServiceError("Failed to create learning path", 500)
  }
  return { revision_id }
}

// Resolve a path by slug. Includes every node (included or skipped) and both the
// frozen projected edges and the live raw edges. Same { metadata, snapshot } shape
// the revision endpoint returns, keyed on the path instead of a revision.
export async function getLearningPathBySlug(supabase: DB, rawSlug: string) {
  const slug = rawSlug.toLowerCase()

  const { data: row, error } = await supabase
    .from("learning_paths")
    .select(`id, slug, status, current_revision_id, ${CURRENT_META}`)
    .eq("slug", slug)
    .maybeSingle()

  if (error) {
    console.error(error)
    throw new ServiceError("Failed to load learning path", 500)
  }
  if (!row || !row.current_revision_id) throw new ServiceError("Learning path not found", 404)

  const { current, ...base } = row
  const path = {
    ...base,
    title: current?.title ?? null,
    summary: current?.summary ?? null,
  }

  const snapshot = await getRevisionSnapshot(supabase, row.current_revision_id)
  return { path, snapshot }
}

// Archive the path. Per RLS this is curator(owner)/moderator-only; a non-permitted
// caller simply matches zero rows and reads as not found.
export async function archiveLearningPath(supabase: DB, rawSlug: string) {
  const { data, error } = await supabase
    .from("learning_paths")
    .update({ status: "archived" })
    .eq("slug", rawSlug.toLowerCase())
    .select("id, slug, status")

  if (error) {
    console.error(error)
    throw new ServiceError("Failed to archive learning path", 500)
  }
  if (!data || data.length === 0) {
    throw new ServiceError("Learning path not found or not permitted", 404)
  }
  return data[0]
}

// The path's revision history, newest first. Drafts (null published_at) sort by
// creation alongside published ones.
export async function listLearningPathRevisions(supabase: DB, rawSlug: string) {
  const { id } = await resolvePath(supabase, rawSlug)

  const { data, error } = await supabase
    .from("learning_path_revisions")
    .select("id, title, change_summary, status, created_at, published_at")
    .eq("learning_path_id", id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error(error)
    throw new ServiceError("Failed to load revisions", 500)
  }
  return data ?? []
}
