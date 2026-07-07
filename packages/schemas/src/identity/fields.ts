import { z } from "zod";

export const usernameSchema = z
  .string()
  .min(3)
  .max(30)
  .regex(/^[a-zA-Z0-9_-]+$/, {
    message:
      "Username may only contain letters, numbers, hyphens, and underscores",
  });

export const displayNameSchema = z.string().max(50);
export const bioSchema = z.string().max(500);
