import { z } from "zod";

// A lightweight subject pointer.
export const subjectReferenceSchema = z.object({
  slug: z.string(),
  name: z.string(),
});

export type SubjectReference = z.infer<typeof subjectReferenceSchema>;
