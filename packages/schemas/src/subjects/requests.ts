import { z } from "zod";
import { subjectNameSchema } from "./fields";

export const createSubjectSchema = z.object({
  name: subjectNameSchema,
});

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
