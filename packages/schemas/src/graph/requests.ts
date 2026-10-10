import { z } from "zod";
import { guideSummarySchema, guideTodoTitleSchema } from "../guides/fields";

export const createPrerequisiteSchema = z.object({
  from_guide_base_id: z.uuid(),
  to_guide_base_id: z.uuid(),
});

export const createRequestSchema = z.object({
  guide_base_id: z.uuid().optional(),
  title: guideTodoTitleSchema,
  summary: guideSummarySchema,
});
