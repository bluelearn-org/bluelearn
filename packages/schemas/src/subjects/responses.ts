import { z } from "zod";

// A subject as listed/browsed. guides_total and paths_total are aggregates
// the API derives from guide_subjects and path_subjects count.
export const subjectSchema = z.object({
  slug: z.string(),
  name: z.string(),
  summary: z.string().nullable(),
  guides_total: z.number().int(),
  paths_total: z.number().int(),
});

export type Subject = z.infer<typeof subjectSchema>;
