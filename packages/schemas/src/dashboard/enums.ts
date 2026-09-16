import { z } from "zod";

export const userStatusSchema = z.enum(["active", "inactive", "suspended"]);

export const userRoleSchema = z.enum([
  "verifier",
  "moderator",
  "curator",
  "admin",
  "official",
]);
