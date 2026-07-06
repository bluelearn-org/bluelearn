import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { ServiceError } from "../lib/service-error";

type DB = SupabaseClient<Database>;

export async function listOpenTodos(supabase: DB) {
  const { data, error } = await supabase
    .from("todo_prerequisites")
    .select("id, dependent_guide_base_id, title, status")
    .eq("status", "open");

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to fetch todos", 500);
  }

  return data ?? [];
}

export async function createTodo(
  supabase: DB,
  dependentGuideBaseId: string,
  title: string
) {
  const { data, error } = await supabase
    .from("todo_prerequisites")
    .insert({
      dependent_guide_base_id: dependentGuideBaseId,
      title,
      status: "open",
    })
    .select("id, dependent_guide_base_id, title, status")
    .single();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to create todo", 500);
  }

  return data;
}
