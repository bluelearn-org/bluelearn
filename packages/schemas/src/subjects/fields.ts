import { z } from "zod";

export const subjectNameSchema = z
  .string()
  .min(3, { message: "Subject must be at least 3 characters long." })
  .max(35, { message: "Subject can be no longer than 35 characters." });

export const subjectSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
