import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { ServiceError } from "../lib/service-error";

type DB = SupabaseClient<Database>;

// Re-evaluate one base's canonical via the promote_canonical_guide RPC. Called
// from castVote / retractVote so a vote that flips the ranking takes effect
// immediately.
export async function promoteCanonicalIfNeeded(
  supabase: DB,
  guideBaseId: string
) {
  const { error } = await supabase.rpc("promote_canonical_guide", {
    p_guide_base_id: guideBaseId,
  });
  if (error) console.error(error);
}

// Cron-path reconciliation: re-evaluate every published base. Catches up
// if an eager call failed and handles tally drift from moderator-side
// vote changes. Mirrors the assemblePendingPanels pattern: one failing
// base must not stall the rest.
export async function promoteAllCanonicals(supabase: DB) {
  const { data: bases, error } = await supabase
    .from("guide_bases")
    .select("id")
    .eq("status", "published");

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load guide bases for promotion", 500);
  }

  // Bases with at least two published variants: only those can flip.
  for (const base of bases ?? []) {
    const { count, error: countError } = await supabase
      .from("guides")
      .select("id", { count: "exact", head: true })
      .eq("guide_base_id", base.id)
      .eq("status", "published");

    if (countError) {
      console.error(countError);
      continue;
    }

    if ((count ?? 0) > 1) {
      const { error: rpcError } = await supabase.rpc(
        "promote_canonical_guide",
        { p_guide_base_id: base.id }
      );
      if (rpcError) console.error(rpcError);
    }
  }
}
