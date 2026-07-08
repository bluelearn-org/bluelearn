import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { ServiceError } from "../lib/service-error";

type DB = SupabaseClient<Database>;

export async function createPrerequisite(
  supabase: DB,
  fromGuideBaseId: string,
  toGuideBaseId: string
) {
  const { data, error } = await supabase
    .from("guide_edges")
    .insert({
      from_guide_base_id: fromGuideBaseId,
      to_guide_base_id: toGuideBaseId,
      edge_type: "prerequisite",
    })
    .select(
      "id, from_guide_base_id, to_guide_base_id, edge_type, is_suspended, created_at"
    )
    .single();

  if (error) {
    switch (error.code) {
      case "23505":
        throw new ServiceError("Prerequisite already exists", 409);
      case "23514":
        throw new ServiceError("Self-loop is not allowed", 422);
      case "P0001":
        throw new ServiceError("This would create a cycle", 409);
      default:
        console.error(error);
        throw new ServiceError("Failed to create prerequisite", 500);
    }
  }

  return data;
}

export async function suspendPrerequisite(supabase: DB, id: string) {
  const { data, error } = await supabase
    .from("guide_edges")
    .update({ is_suspended: true })
    .eq("id", id)
    .select(
      "id, from_guide_base_id, to_guide_base_id, edge_type, is_suspended, created_at"
    )
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to suspend prerequisite", 500);
  }

  if (!data) throw new ServiceError("Prerequisite not found", 404);

  return data;
}
