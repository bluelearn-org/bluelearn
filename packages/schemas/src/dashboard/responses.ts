import { z } from "zod";
import { userStatusSchema } from "./enums";

export const successResponseSchema = z.object({
  success: z.boolean(),
});

export const userStatusResponseSchema = z.object({
  status: userStatusSchema,
});

const userStatusRowSchema = z.object({
  user_id: z.string(),
  status: userStatusSchema,
  updated_at: z.string(),
});
export const updateStatusResponseSchema = z.object({
  data: z.array(userStatusRowSchema),
});

const roleRowSchema = z.object({
  id: z.string(),
  username: z.string(),
  roles: z.array(z.string()),
  date_created: z.string(),
  date_updated: z.string(),
  status: z.string().optional(),
});
export const rolesTableResponseSchema = z.object({
  data: z.array(roleRowSchema),
});

const memberRowSchema = z.object({
  id: z.string(),
  username: z.string(),
  display_name: z.string().nullable(),
  bio: z.string().nullable(),
  date_created: z.string(),
  date_updated: z.string(),
  status: z.string().optional(),
});
export const membersTableResponseSchema = z.object({
  data: z.array(memberRowSchema),
});

const assignmentRowSchema = z.object({
  id: z.string().nullable(),
  panel_id: z.string(),
  username: z.string().optional(),
  type: z.string(),
  title: z.string(),
  date_created: z.string(),
  date_updated: z.string(),
  change_summary: z.string(),
  status: z.string(),
  user_status: z.string().optional(),
  time_left: z.string().nullable(),
});
export const assignmentsTableResponseSchema = z.object({
  data: z.array(assignmentRowSchema),
});
