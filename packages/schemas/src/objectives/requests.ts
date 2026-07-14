import { z } from "zod";
import {
  objectiveChangeSummarySchema,
  objectiveSummarySchema,
  objectiveTitleSchema,
} from "./fields";
import { subjectSlugSchema } from "../subjects";

// Create a draft objective. The objective is built to reach target_ids (at least one
// goal); title is optional at creation and only required to publish.
export const createObjectiveSchema = z.object({
  title: objectiveTitleSchema.nullish(),
  summary: objectiveSummarySchema.nullish(),
  target_ids: z.array(z.uuid()).min(1),
});

// Overwrite a draft revision's metadata. Partial: send only the fields you want
// to change (at least one).
export const updateObjectiveRevisionSchema = z
  .object({
    title: objectiveTitleSchema,
    summary: objectiveSummarySchema.nullish(),
    change_summary: objectiveChangeSummarySchema.nullish(),
    tags: z.array(subjectSlugSchema),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: "at least one field is required",
  });

// Edit one node of a draft revision: swap the pinned variant (guide_id), toggle
// is_target, skip/re-include it (is_included), or set a note. Partial; at least
// one field.
export const updateObjectiveNodeSchema = z
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

export type CreateObjectiveInput = z.infer<typeof createObjectiveSchema>;
export type UpdateObjectiveRevisionInput = z.infer<
  typeof updateObjectiveRevisionSchema
>;
export type UpdateObjectiveNodeInput = z.infer<
  typeof updateObjectiveNodeSchema
>;
