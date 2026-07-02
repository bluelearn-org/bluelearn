import { z } from "zod";

export const createSubjectSchema = z.object({
  name: z
    .string()
    .min(3, { message: "Subject must be at least 3 characters long." })
    .max(35, { message: "Subject can be no longer than 35 characters." }),
});

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;

// A lightweight subject pointer.
export const subjectReferenceSchema = z.object({
  slug: z.string(),
  name: z.string(),
});

// A subject as listed/browsed. guides_total and paths_total are aggregates
// the API derives from guide_subjects and path_subjects count.
export const subjectSchema = z.object({
  slug: z.string(),
  name: z.string(),
  summary: z.string().nullable(),
  guides_total: z.number().int(),
  paths_total: z.number().int(),
});

export type SubjectReference = z.infer<typeof subjectReferenceSchema>;
export type Subject = z.infer<typeof subjectSchema>;
