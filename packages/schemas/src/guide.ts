import { z } from "zod"
import { subjectReferenceSchema } from "./subject"

// A guide starts as an empty draft and is fleshed out in the editor, so
// every field is optional; knowledge_type defaults to theory.
export const createGuideSchema = z.object({
  title: z.string().trim().max(200).nullish(),
  knowledge_type: z.enum(["theory", "practice"]).default("theory"),
  summary: z.string().trim().max(500).nullish(),
  body: z.string().trim().nullish(),
})

// For adding a variant (a method/alternative) under an existing guide. Unlike a newly
// created guide, a variant already has a title, but summary/body stay optional.
export const createVariantSchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(500).nullish(),
  body: z.string().trim().nullish(),
})

// The downvote rubric, mirrored from the downvote_reason enum. Cited on
// downvotes only.
export const downvoteReasons = [
  "unclear",
  "factually_wrong",
  "missing_step",
  "outdated",
  "broken_link",
  "prereq_gap",
  "wrong_level",
  "scope_creep",
] as const

// Cast or update the caller's vote on a variant. reason is required iff the
// direction is down, matching the votes_reason_matches_direction DB constraint.
export const castVoteSchema = z
  .object({
    direction: z.enum(["up", "down"]),
    reason: z.enum(downvoteReasons).nullish(),
    note: z.string().trim().nullish(),
  })
  .refine((v) => (v.direction === "down") === (v.reason != null), {
    message: "reason is required on a downvote and forbidden otherwise",
    path: ["reason"],
  })

// Roll an older revision forward as a new draft. revision_id is the
// snapshot to restore.
export const rollbackRevisionSchema = z.object({
  revision_id: z.uuid(),
})

// Edits to a draft revision before it goes for review. Send only the fields
// you want to change (at least one is required). A user can clear summary, body, or
// change_summary by sending an empty value, but the title must stay set.
export const updateRevisionSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    summary: z.string().trim().max(500).nullish(),
    body: z.string().trim().nullish(),
    change_summary: z.string().trim().max(500).nullish(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: "at least one field is required",
  })

// A lightweight guide pointer (e.g. a node in a path or walkthrough).
export const guideReferenceSchema = z.object({
  slug: z.string(),
  title: z.string(),
})

// A published guide as the frontend consumes it. The body is the markdown (DB's
// guide_revisions.body). word_count is the generated count the client turns into
// reading time via WORDS_PER_MINUTE. prerequisites live on the separate walkthrough
// shape, not this one.
export const guideSchema = z.object({
  slug: z.string(),
  title: z.string(),
  author: z.string(),
  summary: z.string().nullable(),
  body: z.string().nullable(),
  word_count: z.number().int(),
  created_at: z.iso.datetime(),
  tags: z.array(subjectReferenceSchema),
})

// The transitive prerequisite DAG for a guide, from compute_walkthrough. Depth is
// the longest-chain distance from the target (depth 0). The client sorts by depth
// descending for the linear walk and lays out nodes + edges for the graph view.
export const walkthroughSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.uuid(),
      slug: z.string(),
      title: z.string(),
      summary: z.string().nullable(),
      depth: z.number().int(),
    }),
  ),
  edges: z.array(
    z.object({
      from_id: z.uuid(),
      to_id: z.uuid(),
    }),
  ),
})

export type GuideReference = z.infer<typeof guideReferenceSchema>
export type Guide = z.infer<typeof guideSchema>
export type Walkthrough = z.infer<typeof walkthroughSchema>
export type CreateGuideInput = z.infer<typeof createGuideSchema>
export type CreateVariantInput = z.infer<typeof createVariantSchema>
export type CastVoteInput = z.infer<typeof castVoteSchema>
export type RollbackRevisionInput = z.infer<typeof rollbackRevisionSchema>
export type UpdateRevisionInput = z.infer<typeof updateRevisionSchema>
