import { z } from 'zod'

// A guide starts as an empty draft and is fleshed out in the editor, so
// every field is optional; knowledge_type defaults to theory.
export const createGuideSchema = z.object({
  title: z.string().trim().max(200).nullish(),
  knowledge_type: z.enum(['theory', 'practice']).default('theory'),
  summary: z.string().trim().max(500).nullish(),
  body: z.string().trim().nullish(),
})

export type CreateGuideInput = z.infer<typeof createGuideSchema>

// For adding a variant (a method/alternative) under an existing guide. Unlike a newly
// created guide, a variant already has a title, but summary/body stay optional.
export const createVariantSchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(500).nullish(),
  body: z.string().trim().nullish(),
})

export type CreateVariantInput = z.infer<typeof createVariantSchema>

// The downvote rubric, mirrored from the downvote_reason enum. Cited on
// downvotes only.
export const downvoteReasons = [
  'unclear',
  'factually_wrong',
  'missing_step',
  'outdated',
  'broken_link',
  'prereq_gap',
  'wrong_level',
  'scope_creep',
] as const

// Cast or update the caller's vote on a variant. reason is required iff the
// direction is down, matching the votes_reason_matches_direction DB constraint.
export const castVoteSchema = z
  .object({
    direction: z.enum(['up', 'down']),
    reason: z.enum(downvoteReasons).nullish(),
    note: z.string().trim().nullish(),
  })
  .refine((v) => (v.direction === 'down') === (v.reason != null), {
    message: 'reason is required on a downvote and forbidden otherwise',
    path: ['reason'],
  })

export type CastVoteInput = z.infer<typeof castVoteSchema>

// Roll an older revision forward as a new draft. revision_id is the
// snapshot to restore.
export const rollbackRevisionSchema = z.object({
  revision_id: z.uuid(),
})

export type RollbackRevisionInput = z.infer<typeof rollbackRevisionSchema>
