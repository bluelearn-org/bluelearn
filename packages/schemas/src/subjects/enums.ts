import { z } from "zod";

export const subjectStatusSchema = z.enum(["draft", "published"]);

export type SubjectStatus = z.infer<typeof subjectStatusSchema>;
