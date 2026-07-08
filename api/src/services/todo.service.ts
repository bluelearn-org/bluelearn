import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { ServiceError } from "../lib/service-error";

type DB = SupabaseClient<Database>;

// The public board: open todos enriched with the dependent base's identity for
// links. The inner join drops todos whose base the caller cannot see (drafts),
// so the board only ever shows published dependents.
export async function listOpenTodos(supabase: DB) {
  const { data, error } = await supabase
    .from("todo_prerequisites")
    .select(
      `id, dependent_guide_base_id, title, status, created_at,
       base:guide_bases!todo_prerequisites_dependent_guide_base_id_fkey!inner(slug, title)`
    )
    .eq("status", "open");

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to fetch todos", 500);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    guide_base_id: row.dependent_guide_base_id,
    guide_slug: row.base.slug,
    guide_title: row.base.title,
    title: row.title,
    status: row.status,
    created_at: row.created_at,
  }));
}

export async function createTodo(
  supabase: DB,
  guideBaseId: string,
  title: string
) {
  const { data, error } = await supabase
    .from("todo_prerequisites")
    .insert({
      dependent_guide_base_id: guideBaseId,
      title,
      status: "open",
    })
    .select("id, dependent_guide_base_id, title, status, created_at")
    .single();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to create todo", 500);
  }

  return {
    id: data.id,
    guide_base_id: data.dependent_guide_base_id,
    title: data.title,
    status: data.status,
    created_at: data.created_at,
  };
}
