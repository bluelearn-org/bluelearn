import { z } from "zod"
import {
  guideBodySchema,
  guideChangeSummarySchema,
  guideSlugSchema,
  guideSummarySchema,
  guideTitleSchema,
} from "./fields"
import { downvoteReasonSchema, knowledgeTypeSchema, voteDirectionSchema } from "./enums"

// The editable content of a revision.
const revisionContentSchema = z.object({
  title: guideTitleSchema,
  summary: guideSummarySchema.nullish(),
  body: guideBodySchema.nullish(),
})

// The full guide-creation payload, submitted in one POST once the multistep
// contribution form is complete. title, slug, knowledge_type, body, and at
// least one subject are required; summary/prerequisites/related are optional.
export const createGuideSchema = z.object({
  tags: z.array(guideSlugSchema).min(1),
  knowledge_type: knowledgeTypeSchema.default("theory"),
  title: guideTitleSchema,
  slug: guideSlugSchema,
  summary: guideSummarySchema.nullish(),
  prerequisites: z.array(guideSlugSchema).default([]),
  body: guideBodySchema.min(1),
})

// Variants share the parent base's subjects, and a variant's own slug is assigned
// at publish (it stays NULL until then), so the create payload carries only
// its content.
export const createVariantSchema = revisionContentSchema

// Edits to a draft revision before it goes for review. Send only the fields you
// want to change (at least one is required). A user can clear summary, body, or
// change_summary by sending an empty value, but a present title must stay set.
export const updateRevisionSchema = revisionContentSchema
  .extend({ change_summary: guideChangeSummarySchema.nullish() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: "at least one field is required",
  })

// reason is required if the direction is down.
export const castVoteSchema = z
  .object({
    direction: voteDirectionSchema,
    reason: downvoteReasonSchema.nullish(),
    note: z.string().trim().nullish(),
  })
  .refine((v) => (v.direction === "down") === (v.reason != null), {
    message: "reason is required on a downvote and forbidden otherwise",
    path: ["reason"],
  })

export const rollbackRevisionSchema = z.object({
  revision_id: z.uuid(),
})

export type CreateGuideInput = z.infer<typeof createGuideSchema>
export type CreateVariantInput = z.infer<typeof createVariantSchema>
export type UpdateRevisionInput = z.infer<typeof updateRevisionSchema>
export type CastVoteInput = z.infer<typeof castVoteSchema>
export type RollbackRevisionInput = z.infer<typeof rollbackRevisionSchema>
