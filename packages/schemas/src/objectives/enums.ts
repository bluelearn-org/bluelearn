import { z } from "zod";

export const objectiveStatusSchema = z.enum(["draft", "published", "archived"]);

export const objectiveRevisionStatusSchema = z.enum(["draft", "published"]);

export type ObjectiveStatus = z.infer<typeof objectiveStatusSchema>;
export type ObjectiveRevisionStatus = z.infer<
  typeof objectiveRevisionStatusSchema
>;
