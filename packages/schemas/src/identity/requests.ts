import { z } from "zod";
import { bioSchema, displayNameSchema, usernameSchema } from "./fields";

// Only the three grant-writable columns are accepted (username/display_name/
// bio).
export const updateProfileSchema = z
  .object({
    username: usernameSchema,
    display_name: displayNameSchema.nullable(),
    bio: bioSchema.nullable(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: "No fields to update",
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
