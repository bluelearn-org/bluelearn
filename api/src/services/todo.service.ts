import type { SupabaseClient } from "@supabase/supabase-js";
import type { TodoListItem } from "@bluelearn/schemas";
import type { Database } from "../database.types";
import { ServiceError } from "../lib/service-error";

type DB = SupabaseClient<Database>;

export async function listOpenTodos(supabase: DB): Promise<TodoListItem[]> {
  const { data, error } = await supabase
    .from("requests")
    .select(
      `id, dependent_guide_base_id, title, summary, status, created_at,
       claims:request_claims(count),
       base:guide_bases!requests_dependent_guide_base_id_fkey!inner(
         slug,
         canonical:guides!guide_bases_canonical_guide_id_fkey(
           current:guide_revisions!guides_current_revision_id_fkey(title)
         )
       )`
    )
    .eq("status", "open")
    .eq("base.status", "published");

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to fetch todos", 500);
  }

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
