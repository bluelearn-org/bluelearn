import { z } from 'zod'

export const createPrerequisiteSchema = z.object({
  from_guide_base_id: z.string().uuid(),
  to_guide_base_id: z.string().uuid(),
})

export const deletePrerequisiteSchema = z.object({
  guide_edge_id: z.string().uuid(),
})

export const createTodoPrerequisiteSchema = z.object({
  dependent_guide_base_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  resolved_guide_base_id: z.string().uuid().nullish(),
})

export type CreatePrerequisiteInput = z.infer<typeof createPrerequisiteSchema>
export type DeletePrerequisiteInput = z.infer<typeof deletePrerequisiteSchema>
export type CreateTodoPrerequisiteInput = z.infer<typeof createTodoPrerequisiteSchema>
