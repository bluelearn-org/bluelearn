import { z } from "zod";
import { subjectNameSchema } from "./fields";

export const createSubjectSchema = z.object({
  name: subjectNameSchema,
});

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;

// The whole floor at once; an empty list clears it.
export const setSubjectFloorSchema = z.object({
  guide_base_ids: z.array(z.uuid()).max(200),
});

export type SetSubjectFloorInput = z.infer<typeof setSubjectFloorSchema>;
