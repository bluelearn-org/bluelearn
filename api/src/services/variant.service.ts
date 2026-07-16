import type { SupabaseClient } from "@supabase/supabase-js";
import type { CastVoteInput } from "@bluelearn/schemas";
import type { Database } from "../database.types";
import { ServiceError } from "../lib/service-error";
import {
  promoteCanonicalIfNeeded,
  type PromotionResult,
} from "./promotion.service";

type DB = SupabaseClient<Database>;

// A variant's detail is its live revision content; the public vote tally is
// attached separately.
const VARIANT_DETAIL = `
  id, guide_base_id, slug, status,
  current:guide_revisions!guides_current_revision_id_fkey(id, title, summary, body, created_at)
`;

// Confirm the variant (a guides row) is visible to the caller, or 404, and
// return the row. RLS hides drafts, so an unseen variant reads as missing.
async function requireVariant(supabase: DB, id: string) {
  const { data, error } = await supabase
    .from("guides")
    .select("id, current_revision_id, guide_base_id")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load variant", 500);
  }
  if (!data) throw new ServiceError("Variant not found", 404);
  return data;
}

// Attach the public vote tally (counts only) to a variant.
async function withVotes<T extends { id: string }>(supabase: DB, variant: T) {
  const { data: tally, error } = await supabase
    .from("guide_vote_tallies")
    .select("upvotes, downvotes")
    .eq("guide_id", variant.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load vote tally", 500);
  }
  return {
    ...variant,
    votes: { up: tally?.upvotes ?? 0, down: tally?.downvotes ?? 0 },
  };
}

// Resolve a variant by id to its content + public vote tally.
export async function getVariant(supabase: DB, id: string) {
  const { data: variant, error } = await supabase
    .from("guides")
    .select(VARIANT_DETAIL)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load variant", 500);
  }
  if (!variant) throw new ServiceError("Variant not found", 404);

  return { variant: await withVotes(supabase, variant) };
}

// Archive the variant. Per RLS only the author or a moderator may; a
// non-permitted caller matches zero rows.
export async function archiveVariant(supabase: DB, id: string) {
  const { data, error } = await supabase
    .from("guides")
    .update({ status: "archived" })
    .eq("id", id)
    .select("id, slug, status");

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to archive variant", 500);
  }
  if (!data || data.length === 0) {
    throw new ServiceError("Variant not found or not permitted", 404);
  }
  return data[0];
}

// Cast or update the caller's vote: one row per (voter, variant), re-voting
// overwrites it. RLS restricts voting to published variants.
export async function castVote(
  supabase: DB,
  voterId: string,
  id: string,
  input: CastVoteInput
) {
  const variant = await requireVariant(supabase, id);

  const { data, error } = await supabase
    .from("votes")
    .upsert(
      {
        voter_id: voterId,
        guide_id: id,
        direction: input.direction,
        reason: input.reason ?? null,
        note: input.note || null,
      },
      { onConflict: "voter_id,guide_id" }
    )
    .select("guide_id, direction, reason, note, updated_at")
    .single();

  if (error) throw new ServiceError("Unable to cast vote", 400);
  // reason belongs to downvotes only; drop the NULL so an upvote payload omits
  // it rather than carrying a non-enum null.
  const { reason, ...rest } = data;
  const vote = reason === null ? rest : { ...rest, reason };

  // Best-effort canonical promotion. A failure here must not roll back the
  // vote; the cron reconciliation will catch up.
  let promotion: PromotionResult;
  try {
    promotion = await promoteCanonicalIfNeeded(supabase, variant.guide_base_id);
  } catch (err) {
    console.error(err);
    promotion = { canonical_guide_id: null, promoted: false };
  }
  return { vote, promotion };
}

// Retract the caller's vote. A no-op delete (no matching row) is still success.
// Returns the promotion check result so the route can surface it.
export async function retractVote(
  supabase: DB,
  voterId: string,
  id: string
): Promise<PromotionResult> {
  const variant = await requireVariant(supabase, id);

  const { error } = await supabase
    .from("votes")
    .delete()
    .eq("voter_id", voterId)
    .eq("guide_id", id);

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to retract vote", 500);
  }

  // Retracting a vote from the current canonical can drop it below the
  // margin, letting a challenger take over. Best-effort, like castVote.
  try {
    return await promoteCanonicalIfNeeded(supabase, variant.guide_base_id);
  } catch (err) {
    console.error(err);
    return { canonical_guide_id: null, promoted: false };
  }
}

// The variant's published-version timeline: only revisions that went live,
// newest live first. Ordered by approved_at (when each became the guide's
// current content), not authoring order, so an early draft approved late lands
// where it went live. Empty until the review flow promotes a revision.
export async function listVariantRevisions(supabase: DB, id: string) {
  await requireVariant(supabase, id);

  const { data, error } = await supabase
    .from("guide_revisions")
    .select("id, created_at, approved_at")
    .eq("guide_id", id)
    .not("approved_at", "is", null)
    .order("approved_at", { ascending: false });

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load variant revisions", 500);
  }

  return (data ?? []).map((rev) => ({
    id: rev.id,
    status: "approved" as const,
    created_at: rev.created_at,
    approved_at: rev.approved_at,
  }));
}

// Start a new draft revision on an already-published variant, seeded from its
// live content. Pre-publish work (the draft create_variant made) and a returned-for-edit
// attempt (a rejected revision the review routes reopened to 'draft') are both edited
// in place, not through here, so a live current_revision_id is always present.
export async function createVariantRevision(
  supabase: DB,
  authorId: string,
  id: string
) {
  const variant = await requireVariant(supabase, id);

  // Verify that the variant points at a published revision
  if (!variant.current_revision_id) {
    throw new ServiceError("Variant has no published revision to revise", 409);
  }

  const { data: source, error: sourceError } = await supabase
    .from("guide_revisions")
    .select("title, summary, body")
    .eq("id", variant.current_revision_id)
    .maybeSingle();

  if (sourceError) {
    console.error(sourceError);
    throw new ServiceError("Failed to load variant", 500);
  }

  const { data, error } = await supabase
    .from("guide_revisions")
    .insert({
      guide_id: id,
      title: source?.title ?? null,
      summary: source?.summary ?? null,
      body: source?.body ?? null,
      author_id: authorId,
      status: "draft",
    })
    .select("id")
    .single();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to create revision", 500);
  }
  return { revision_id: data.id };
}

// Roll an older revision forward as a new draft: copy its snapshot into a fresh
// draft row. The source must belong to this variant; never destructive.
export async function rollbackVariant(
  supabase: DB,
  authorId: string,
  id: string,
  sourceRevisionId: string
) {
  await requireVariant(supabase, id);

  const { data: source, error: sourceError } = await supabase
    .from("guide_revisions")
    .select("title, summary, body, created_at")
    .eq("id", sourceRevisionId)
    .eq("guide_id", id)
    .maybeSingle();

  if (sourceError) {
    console.error(sourceError);
    throw new ServiceError("Failed to load revision", 500);
  }
  if (!source)
    throw new ServiceError("Revision not found for this variant", 404);

  const { data, error } = await supabase
    .from("guide_revisions")
    .insert({
      guide_id: id,
      title: source.title,
      summary: source.summary,
      body: source.body,
      change_summary: `Rolled back to revision from ${source.created_at.slice(0, 10)}`,
      author_id: authorId,
      status: "draft",
    })
    .select("id")
    .single();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to create revision", 500);
  }
  return { revision_id: data.id };
}
