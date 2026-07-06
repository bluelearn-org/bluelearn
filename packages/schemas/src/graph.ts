import { z } from "zod";

export const createPrerequisiteSchema = z.object({
  from_guide_base_id: z.uuid(),
  to_guide_base_id: z.uuid(),
});

export const createTodoPrerequisiteSchema = z.object({
  dependent_guide_base_id: z.uuid(),
  title: z.string().min(1),
});
