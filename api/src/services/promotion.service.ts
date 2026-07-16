import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { ServiceError } from "../lib/service-error";

type DB = SupabaseClient<Database>;

export type PromotionResult = {
  canonical_guide_id: string | null;
  promoted: boolean;
};

// Calls the promote_canonical_guide RPC for one base. Used by castVote /
// retractVote so a vote that flips the ranking is reflected immediately.
// Returns { canonical_guide_id, promoted } so the route can surface the
// outcome to the caller. A missing base returns null without throwing.
// The vote itself already succeeded; promotion is best-effort.
export async function promoteCanonicalIfNeeded(
  supabase: DB,
  guideBaseId: string
): Promise<PromotionResult> {
  const { data: before, error: beforeError } = await supabase
    .from("guide_bases")
    .select("canonical_guide_id")
    .eq("id", guideBaseId)
    .maybeSingle();

  if (beforeError) {
    console.error(beforeError);
    throw new ServiceError("Failed to load guide base for promotion", 500);
  }
  if (!before) {
    // Base missing: vote path already validated it, so this is a race.
    // Report no promotion rather than crashing the vote.
    return { canonical_guide_id: null, promoted: false };
  }

  const beforeId = before.canonical_guide_id ?? null;

  const { data: afterId, error: rpcError } = await supabase.rpc(
    "promote_canonical_guide",
    { p_guide_base_id: guideBaseId }
  );

  if (rpcError) {
    console.error(rpcError);
    throw new ServiceError("Failed to evaluate canonical promotion", 500);
  }

  const newId = (afterId as string | null) ?? null;
  return {
    canonical_guide_id: newId,
    promoted: newId !== null && newId !== beforeId,
  };
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
