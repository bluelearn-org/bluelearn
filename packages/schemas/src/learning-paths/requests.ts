import { z } from "zod";
import {
  pathChangeSummarySchema,
  pathSummarySchema,
  pathTitleSchema,
} from "./fields";

// Create a draft path. The path is built to reach target_ids (at least one
// goal); title is optional at creation and only required to publish.
export const createLearningPathSchema = z.object({
  title: pathTitleSchema.nullish(),
  summary: pathSummarySchema.nullish(),
  target_ids: z.array(z.uuid()).min(1),
});

// Overwrite a draft revision's metadata. Partial: send only the fields you want
// to change (at least one).
export const updatePathRevisionSchema = z
  .object({
    title: pathTitleSchema,
    summary: pathSummarySchema.nullish(),
    change_summary: pathChangeSummarySchema.nullish(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: "at least one field is required",
  });

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
  });

export type CreateLearningPathInput = z.infer<typeof createLearningPathSchema>;
export type UpdatePathRevisionInput = z.infer<typeof updatePathRevisionSchema>;
export type UpdatePathNodeInput = z.infer<typeof updatePathNodeSchema>;
