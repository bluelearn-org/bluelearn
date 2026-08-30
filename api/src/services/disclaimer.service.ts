import type { SupabaseClient } from "@supabase/supabase-js";
import type { DisclaimerSlug } from "@bluelearn/schemas";
import type { Database } from "../database.types";
import { ServiceError } from "../lib/service-error";

type DB = SupabaseClient<Database>;

// Load disclaimer slugs for a guide base.
export async function loadDisclaimers(
  supabase: DB,
  baseId: string
): Promise<DisclaimerSlug[]> {
  const { data, error } = await supabase
    .from("guide_disclaimers")
    .select("disclaimers!inner(slug)")
    .eq("guide_base_id", baseId);

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load disclaimers", 500);
  }
  return (data ?? [])
    .map((r) => r.disclaimers?.slug)
    .filter((s): s is DisclaimerSlug => s != null);
}

// Replace a guide base's disclaimer set.
export async function replaceDisclaimers(
  supabase: DB,
  baseId: string,
  slugs: DisclaimerSlug[]
) {
  const unique = [...new Set(slugs)];

  const { error: delError } = await supabase
    .from("guide_disclaimers")
    .delete()
    .eq("guide_base_id", baseId);
  if (delError) {
    console.error(delError);
    throw new ServiceError("Unable to update disclaimers", 400);
  }

  if (unique.length === 0) return;

  const { data: disclaimerRows, error: lookupError } = await supabase
    .from("disclaimers")
    .select("id, slug")
    .in("slug", unique);
  if (lookupError) {
    console.error(lookupError);
    throw new ServiceError("Failed to resolve disclaimers", 500);
  }
  if ((disclaimerRows ?? []).length !== unique.length) {
    throw new ServiceError("Unknown disclaimer slug", 400);
  }

  const { error: insError } = await supabase
    .from("guide_disclaimers")
    .insert(
      disclaimerRows!.map((d) => ({
        guide_base_id: baseId,
        disclaimer_id: d.id,
      }))
    );
  if (insError) {
    console.error(insError);
    throw new ServiceError("Unable to update disclaimers", 400);
  }
}
