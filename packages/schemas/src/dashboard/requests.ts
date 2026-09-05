import { z } from "zod";
import { userStatusSchema, userRoleSchema } from "./enums";

export const updateStatusSchema = z.object({
  status: userStatusSchema,
});

export const updateRoleSchema = z.object({
  role: userRoleSchema,
});

export const roleParamSchema = z.object({
  id: z.string(),
  roleName: userRoleSchema,
});

export const idParamSchema = z.object({
  id: z.string(),
});

export const reassignParamSchema = z.object({
  id: z.string(),
  panel_id: z.string(),
});
