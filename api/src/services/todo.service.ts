import type { SupabaseClient } from "@supabase/supabase-js";
import type { TodoListItem } from "@bluelearn/schemas";
import type { Database } from "../database.types";
import { ServiceError } from "../lib/service-error";
import { selectInBatches } from "../lib/batch";

type DB = SupabaseClient<Database>;

// Published objectives that list a requesting guide in their current revision,
// keyed by guide base id. Todos don't carry subjects/objectives directly, so
// the todos page filters by the requesting guide's associations.
async function loadGuideObjectives(
  supabase: DB,
  baseIds: string[]
): Promise<Map<string, Array<{ slug: string; title: string }>>> {
  const map = new Map<string, Array<{ slug: string; title: string }>>();
  if (baseIds.length === 0) return map;

  const { data: nodes, error: nodeError } = await selectInBatches(
    baseIds,
    (batch) =>
      supabase
        .from("objective_revision_nodes")
        .select("guide_base_id, revision_id")
        .in("guide_base_id", batch)
  );
  if (nodeError) {
    console.error(nodeError);
    throw new ServiceError("Failed to load todo objectives", 500);
  }

  const revisionIds = [...new Set((nodes ?? []).map((n) => n.revision_id))];
  if (revisionIds.length === 0) return map;

  const { data: objectives, error: objectiveError } = await selectInBatches(
    revisionIds,
    (batch) =>
      supabase
        .from("objectives")
        .select(
          `id, current_revision_id, slug,
           current:objective_revisions!objectives_current_revision_id_fkey(title)`
        )
        .in("current_revision_id", batch)
        .eq("status", "published")
  );
  if (objectiveError) {
    console.error(objectiveError);
    throw new ServiceError("Failed to load todo objectives", 500);
  }

  const objectivesByRevision = new Map<
    string,
    Array<{ slug: string; title: string }>
  >();
  for (const objective of objectives ?? []) {
    if (!objective.current_revision_id || !objective.slug) continue;
    if (!objective.current?.title) continue;
    const list = objectivesByRevision.get(objective.current_revision_id) ?? [];
    list.push({ slug: objective.slug, title: objective.current.title });
    objectivesByRevision.set(objective.current_revision_id, list);
  }

  for (const node of nodes ?? []) {
    for (const objective of objectivesByRevision.get(node.revision_id) ?? []) {
      const list = map.get(node.guide_base_id) ?? [];
      list.push(objective);
      map.set(node.guide_base_id, list);
    }
  }

  for (const list of map.values())
    list.sort((a, b) => a.title.localeCompare(b.title));
  return map;
}

export async function listOpenTodos(supabase: DB): Promise<TodoListItem[]> {
  const { data, error } = await supabase
    .from("requests")
    .select(
      `id, dependent_guide_base_id, title, summary, status, created_at,
       claims:request_claims(count),
       base:guide_bases!requests_dependent_guide_base_id_fkey!inner(
         slug,
         canonical:guides!guide_bases_canonical_guide_id_fkey(
           current:guide_revisions!guides_current_revision_id_fkey(
             title,
             subjects:guide_revision_subjects(subjects(slug, name))
           )
         )
       )`
    )
    .eq("status", "open")
    .eq("base.status", "published");

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to fetch todos", 500);
  }

  const objectivesByBase = await loadGuideObjectives(
    supabase,
    (data ?? []).map((row) => row.dependent_guide_base_id)
  );

  return (data ?? []).map((row) => ({
    id: row.id,
    guide_base_id: row.dependent_guide_base_id,
    guide_slug: row.base.slug,
    guide_title: row.base.canonical?.current?.title ?? null,
    title: row.title,
    summary: row.summary,
    status: row.status,
    claim_count: row.claims[0]?.count ?? 0,
    created_at: row.created_at,
    subjects: (row.base.canonical?.current?.subjects ?? [])
      .map((s) => s.subjects)
      .filter((s): s is { slug: string; name: string } => !!s?.slug),
    objectives: objectivesByBase.get(row.dependent_guide_base_id) ?? [],
  }));
}

export async function createTodo(
  supabase: DB,
  guideBaseId: string,
  title: string,
  summary: string
) {
  const { data, error } = await supabase
    .from("requests")
    .insert({
      dependent_guide_base_id: guideBaseId,
      title,
      summary,
      status: "open",
    })
    .select("id, dependent_guide_base_id, title, summary, status, created_at")
    .single();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to create todo", 500);
  }

  return {
    id: data.id,
    guide_base_id: data.dependent_guide_base_id,
    title: data.title,
    summary: data.summary,
    status: data.status,
    created_at: data.created_at,
  };
}

// Claim the todos a contributor started from, so the todo page can show the topic is
// being written and publish knows which rows to close.
export async function claimTodos(
  supabase: DB,
  guideBaseId: string,
  todoIds: Array<string>
) {
  const { data, error } = await supabase
    .from("requests")
    .select("id, status")
    .in("id", todoIds);

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to claim todos", 500);
  }

  if ((data ?? []).length !== todoIds.length) {
    throw new ServiceError("Todo not found", 404);
  }
  if ((data ?? []).some((todo) => todo.status !== "open")) {
    throw new ServiceError("Todo is already resolved", 409);
  }

  const { error: claimError } = await supabase
    .from("request_claims")
    .insert(todoIds.map((id) => ({ todo_id: id, guide_base_id: guideBaseId })));

  if (claimError) {
    console.error(claimError);
    throw new ServiceError("Failed to claim todos", 500);
  }
}
