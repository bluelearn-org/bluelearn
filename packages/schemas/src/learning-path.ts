import { z } from "zod"
import { subjectReferenceSchema } from "./subject"
import { guideReferenceSchema } from "./guide"

// Create a draft path. The path is built to reach target_ids (at least one
// goal); title is optional at creation and only required to publish.
export const createLearningPathSchema = z.object({
  title: z.string().trim().max(200).nullish(),
  summary: z.string().trim().max(500).nullish(),
  target_ids: z.array(z.uuid()).min(1),
})

// Overwrite a draft revision's metadata. Partial: send only the fields you want
// to change (at least one).
export const updatePathRevisionSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    summary: z.string().trim().max(500).nullish(),
    change_summary: z.string().trim().max(500).nullish(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: "at least one field is required",
  })

// Edit one node of a draft revision: swap the pinned variant (guide_id), toggle
// is_target, skip/re-include it (is_included), or set a note. Partial; at least
// one field.
export const updatePathNodeSchema = z
  .object({
    guide_id: z.uuid(),
    is_target: z.boolean(),
    is_included: z.boolean(),
    note: z.string().trim().nullish(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: "at least one field is required",
  })

export const pathNodeSchema = z.object({
  guide: guideReferenceSchema,
  level: z.number().int(),
  is_target: z.boolean(),
  is_included: z.boolean(),
  note: z.string().nullable(),
  word_count: z.number().int(),
})

// A prerequisite edge between two nodes.
export const pathEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
})

// A learning path's metadata, the leveled nodes, and the edges. word_count
// is the sum over included nodes the client turns into total reading time.
export const learningPathSchema = z.object({
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  curator: z.string(),
  created_at: z.iso.datetime(),
  word_count: z.number().int(),
  tags: z.array(subjectReferenceSchema),
  nodes: z.array(pathNodeSchema),
  edges: z.array(pathEdgeSchema),
})

export type PathNode = z.infer<typeof pathNodeSchema>
export type PathEdge = z.infer<typeof pathEdgeSchema>
export type LearningPath = z.infer<typeof learningPathSchema>
export type CreateLearningPathInput = z.infer<typeof createLearningPathSchema>
export type UpdatePathRevisionInput = z.infer<typeof updatePathRevisionSchema>
export type UpdatePathNodeInput = z.infer<typeof updatePathNodeSchema>
