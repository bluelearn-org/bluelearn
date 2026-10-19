import { z } from "zod";
import {
  decisionReasonSchema,
  reviewAnchorKindSchema,
  reviewSuggestionStatusSchema,
} from "./enums";

// An approve carries optional notes, whereas a reject must carry notes plus
// at least one rubric reason.
export const createDecisionSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("approved"),
    notes: z.string().trim().nullish(),
  }),
  z.object({
    decision: z.literal("rejected"),
    notes: z.string().trim().min(1),
    reasons: z.array(decisionReasonSchema).min(1),
  }),
]);

export type CreateDecisionInput = z.infer<typeof createDecisionSchema>;

// Same numbers as the review_threads and review_suggestions checks. The text
// limits here count UTF-16 units and the checks count characters, so astral
// text reaches the API limit first.
export const REVIEW_COMMENT_MAX_LENGTH = 10_000;
export const REVIEW_QUOTE_MAX_LENGTH = 2_000;
export const REVIEW_PROPOSED_MAX_LENGTH = 20_000;
export const REVIEW_BLOCK_INDEX_MAX = 10_000;

const blockIndexSchema = z.number().int().min(0).max(REVIEW_BLOCK_INDEX_MAX);
const offsetSchema = z.number().int().min(0);
const reviewTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(REVIEW_COMMENT_MAX_LENGTH);

// The server can check source offsets against the body, but not rendered-text
// offsets, so their internal agreement is the only guard it has on them.
function isCoherentAnchor(anchor: {
  kind: "passage" | "block";
  start_block: number;
  start_offset: number;
  end_block: number;
  end_offset: number;
  quote: string;
  source_start: number | null;
  source_end: number | null;
}) {
  if ((anchor.source_start === null) !== (anchor.source_end === null))
    return false;
  if (
    anchor.source_start !== null &&
    anchor.source_end !== null &&
    anchor.source_end <= anchor.source_start
  )
    return false;
  if (anchor.end_block < anchor.start_block) return false;

  const oneBlock = anchor.start_block === anchor.end_block;
  if (anchor.kind === "block")
    return (
      oneBlock &&
      anchor.start_offset === 0 &&
      anchor.quote.length <= anchor.end_offset
    );

  if (anchor.quote.trim() === "") return false;
  return (
    !oneBlock || anchor.end_offset - anchor.start_offset === anchor.quote.length
  );
}

// Where feedback sits in the reviewed revision. source_start/source_end are
// UTF-16 offsets into revision.body (react-markdown positions), null when a
// plugin-made block has none.
export const reviewAnchorInputSchema = z
  .object({
    revision_id: z.uuid(),
    kind: reviewAnchorKindSchema,
    start_block: blockIndexSchema,
    start_offset: offsetSchema,
    end_block: blockIndexSchema,
    end_offset: offsetSchema,
    quote: z.string().max(REVIEW_QUOTE_MAX_LENGTH),
    source_start: offsetSchema.nullable(),
    source_end: offsetSchema.nullable(),
  })
  .refine(isCoherentAnchor, { message: "Incoherent anchor" });

export const createReviewThreadSchema = z.object({
  anchor: reviewAnchorInputSchema,
  body: reviewTextSchema,
});

export const createReviewReplySchema = z.object({
  body: reviewTextSchema,
});

// A suggestion replaces the whole source of one block, so it needs both
// source offsets.
export const createReviewSuggestionSchema = z.object({
  anchor: reviewAnchorInputSchema.and(
    z.object({
      kind: z.literal("block"),
      source_start: offsetSchema,
      source_end: offsetSchema,
    })
  ),
  proposed: z.string().max(REVIEW_PROPOSED_MAX_LENGTH),
  note: z.string().trim().max(REVIEW_COMMENT_MAX_LENGTH).nullish(),
});

export const decideReviewSuggestionSchema = z.object({
  decision: reviewSuggestionStatusSchema.exclude(["pending"]),
});

export type ReviewAnchorInput = z.infer<typeof reviewAnchorInputSchema>;
export type CreateReviewThreadInput = z.infer<typeof createReviewThreadSchema>;
export type CreateReviewReplyInput = z.infer<typeof createReviewReplySchema>;
export type CreateReviewSuggestionInput = z.infer<
  typeof createReviewSuggestionSchema
>;
export type DecideReviewSuggestionInput = z.infer<
  typeof decideReviewSuggestionSchema
>;
