import { z } from "zod";
import { userStatusSchema } from "./enums";
import {
  applicableRoleSchema,
  roleApplicationStatusSchema,
} from "../identity/enums";

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
  total: z.number().int(),
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
  total: z.number().int(),
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
  total: z.number().int(),
});

const roleApplicationRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  username: z.string(),
  role: applicableRoleSchema,
  status: roleApplicationStatusSchema,
  statement: z.string().nullable(),
  date_created: z.string(),
  date_decided: z.string().nullable(),
  // The deciding admin's username; null while pending or when the role was
  // granted by the service role.
  decided_by: z.string().nullable(),
});
export const roleApplicationsTableResponseSchema = z.object({
  data: z.array(roleApplicationRowSchema),
  total: z.number().int(),
});
