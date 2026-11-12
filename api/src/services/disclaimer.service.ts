import type { SupabaseClient } from "@supabase/supabase-js";
import type { DisclaimerSlug } from "@bluelearn/schemas";
import type { Database } from "../database.types";
import { ServiceError } from "../lib/service-error";

type DB = SupabaseClient<Database>;

// Load the live disclaimer slugs of a guide (the original or a variant).
export async function loadDisclaimers(
  supabase: DB,
  guideId: string | null
): Promise<DisclaimerSlug[]> {
  if (!guideId) return [];

  const { data, error } = await supabase
    .from("guide_disclaimers")
    .select("disclaimers!inner(slug)")
    .eq("guide_id", guideId);

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load disclaimers", 500);
  }
  return (data ?? [])
    .map((r) => r.disclaimers?.slug)
    .filter((s): s is DisclaimerSlug => s != null);
}

// Load the disclaimer slugs a revision proposes for its guide.
export async function loadRevisionDisclaimers(
  supabase: DB,
  revisionId: string
): Promise<DisclaimerSlug[]> {
  const { data, error } = await supabase
    .from("guide_revision_disclaimers")
    .select("disclaimers!inner(slug)")
    .eq("guide_revision_id", revisionId);

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load disclaimers", 500);
  }
  return (data ?? [])
    .map((r) => r.disclaimers?.slug)
    .filter((s): s is DisclaimerSlug => s != null);
}

// Resolve slugs to disclaimer ids, rejecting any the table doesn't know.
async function resolveDisclaimerIds(supabase: DB, slugs: DisclaimerSlug[]) {
  if (slugs.length === 0) return [];

  const { data, error } = await supabase
    .from("disclaimers")
    .select("id")
    .in("slug", slugs);
  if (error) {
    console.error(error);
    throw new ServiceError("Failed to resolve disclaimers", 500);
  }
  if ((data ?? []).length !== slugs.length) {
    throw new ServiceError("Unknown disclaimer slug", 400);
  }
  return data.map((d) => d.id);
}

// Replace a guide's live disclaimer set.
export async function replaceDisclaimers(
  supabase: DB,
  guideId: string,
  slugs: DisclaimerSlug[]
) {
  const ids = await resolveDisclaimerIds(supabase, [...new Set(slugs)]);

  const { error: delError } = await supabase
    .from("guide_disclaimers")
    .delete()
    .eq("guide_id", guideId);
  if (delError) {
    console.error(delError);
    throw new ServiceError("Unable to update disclaimers", 400);
  }

  if (ids.length === 0) return;

  const { error: insError } = await supabase.from("guide_disclaimers").insert(
    ids.map((id) => ({
      guide_id: guideId,
      disclaimer_id: id,
    }))
  );
  if (insError) {
    console.error(insError);
    throw new ServiceError("Unable to update disclaimers", 400);
  }
}

// Replace the disclaimer set a draft revision proposes. Approval copies it onto
// the revision's guide.
export async function replaceRevisionDisclaimers(
  supabase: DB,
  revisionId: string,
  slugs: DisclaimerSlug[]
) {
  const ids = await resolveDisclaimerIds(supabase, [...new Set(slugs)]);

  const { error: delError } = await supabase
    .from("guide_revision_disclaimers")
    .delete()
    .eq("guide_revision_id", revisionId);
  if (delError) {
    console.error(delError);
    throw new ServiceError("Unable to update disclaimers", 400);
  }

  if (ids.length === 0) return;

  const { error: insError } = await supabase
    .from("guide_revision_disclaimers")
    .insert(
      ids.map((id) => ({
        guide_revision_id: revisionId,
        disclaimer_id: id,
      }))
    );
  if (insError) {
    console.error(insError);
    throw new ServiceError("Unable to update disclaimers", 400);
  }
}
