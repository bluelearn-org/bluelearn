import { z } from 'zod'

export const createSubjectSchema = z.object({
  name: z.string()
    .min(3, { message: "Subject must be at least 3 characters long."})
    .max(35, { message: "Subject can be no longer than 35 characters."})
})

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>
