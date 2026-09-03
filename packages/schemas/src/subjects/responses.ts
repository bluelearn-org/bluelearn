import { z } from "zod";
import { guideListItemSchema } from "../guides/responses";
import { objectiveListItemSchema } from "../objectives/responses";

export const subjectSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
});

// A subject as listed/browsed. guides_total and objectives_total are aggregates
// counting the guides/objectives whose current revision carries the tag.
export const subjectListItemSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  summary: z.string().nullable(),
  guides_total: z.number().int(),
  objectives_total: z.number().int(),
});

export const subjectGroupSchema = z.object({
  char: z.string(),
  subjects: z.array(subjectListItemSchema),
});

const totalSchema = z.number().int().min(0);

export const subjectListResponseSchema = z.strictObject({
  subjects: z.array(subjectListItemSchema),
  total: totalSchema,
});

export const subjectGroupsResponseSchema = z.strictObject({
  groups: z.array(subjectGroupSchema),
});

export const subjectResponseSchema = z.strictObject({
  subject: subjectSchema,
});

export const subjectGuidesResponseSchema = z.strictObject({
  guides: z.array(guideListItemSchema),
  total: totalSchema,
});

export const subjectObjectivesResponseSchema = z.strictObject({
  objectives: z.array(objectiveListItemSchema),
  total: totalSchema,
});

export type Subject = z.infer<typeof subjectSchema>;
export type SubjectListItem = z.infer<typeof subjectListItemSchema>;
export type SubjectGroup = z.infer<typeof subjectGroupSchema>;
