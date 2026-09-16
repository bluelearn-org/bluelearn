import { z } from "zod";
import { subjectStatusSchema } from "./enums";

// A lightweight subject pointer.
export const subjectReferenceSchema = z.object({
  slug: z.string(),
  name: z.string(),
});

export const subjectTagSchema = z.object({
  id: z.uuid(),
  slug: z.string().nullable(),
  name: z.string(),
  summary: z.string().nullable(),
  status: subjectStatusSchema,
});

export type SubjectReference = z.infer<typeof subjectReferenceSchema>;
export type SubjectReferences = Array<SubjectReference>;
export type SubjectTag = z.infer<typeof subjectTagSchema>;
