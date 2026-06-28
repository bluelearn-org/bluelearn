import { z } from "zod"

// Only the three grant-writable columns are accepted (username/display_name/
// bio).
export const updateProfileSchema = z
  .object({
    username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/, {
      message: "Username may only contain letters, numbers, hyphens, and underscores",
    }),
    display_name: z.string().max(50).nullable(),
    bio: z.string().max(500).nullable(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: "No fields to update" })

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
