import { z } from "zod";
import { paginationSchema } from "../pagination";
import { reviewCaseTypeSchema, reviewSeatStatusSchema } from "../review/enums";
import { userStatusSchema, userRoleSchema } from "./enums";
import {
  applicableRoleSchema,
  roleApplicationDecisionSchema,
  roleApplicationStatusSchema,
} from "../identity/enums";

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

// A query parameter sent once arrives as a string, sent twice as an array.
const oneOrMany = <T extends z.ZodType>(value: T) =>
  z.union([value, z.array(value)]).optional();

// "none" matches members with no status, or no roles.
const statusFilterSchema = z.union([userStatusSchema, z.literal("none")]);
const roleFilterSchema = z.union([userRoleSchema, z.literal("none")]);

// The app turns local calendar days and hours left into instants, so the
// server never guesses a timezone. `_from` is inclusive, `_to` exclusive.
const instant = z.iso.datetime().optional();

const tablePageSchema = paginationSchema.extend({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sortDirection: z.enum(["asc", "desc"]).default("asc"),
});

export const membersTableQuerySchema = tablePageSchema.extend({
  sortBy: z
    .enum([
      "username",
      "display_name",
      "bio",
      "date_created",
      "date_updated",
      "status",
    ])
    .optional(),
  username: z.string().optional(),
  display_name: z.string().optional(),
  bio: z.string().optional(),
  status: oneOrMany(statusFilterSchema),
  date_created_from: instant,
  date_created_to: instant,
  date_updated_from: instant,
  date_updated_to: instant,
});

export const rolesTableQuerySchema = tablePageSchema.extend({
  sortBy: z
    .enum(["username", "roles", "date_created", "date_updated", "status"])
    .optional(),
  username: z.string().optional(),
  roles: oneOrMany(roleFilterSchema),
  status: oneOrMany(statusFilterSchema),
  date_created_from: instant,
  date_created_to: instant,
  date_updated_from: instant,
  date_updated_to: instant,
});

export const assignmentsTableQuerySchema = tablePageSchema.extend({
  sortBy: z
    .enum([
      "username",
      "user_status",
      "time_left",
      "status",
      "type",
      "title",
      "change_summary",
      "date_created",
      "date_updated",
    ])
    .optional(),
  username: z.string().optional(),
  user_status: oneOrMany(statusFilterSchema),
  time_left_from: instant,
  time_left_to: instant,
  status: oneOrMany(reviewSeatStatusSchema),
  type: oneOrMany(reviewCaseTypeSchema),
  title: z.string().optional(),
  change_summary: z.string().optional(),
  date_created_from: instant,
  date_created_to: instant,
  date_updated_from: instant,
  date_updated_to: instant,
});

export const roleApplicationsTableQuerySchema = tablePageSchema.extend({
  sortBy: z
    .enum([
      "username",
      "role",
      "status",
      "statement",
      "date_created",
      "date_decided",
    ])
    .optional(),
  username: z.string().optional(),
  role: oneOrMany(applicableRoleSchema),
  status: oneOrMany(roleApplicationStatusSchema),
  statement: z.string().optional(),
  date_created_from: instant,
  date_created_to: instant,
  date_decided_from: instant,
  date_decided_to: instant,
});

export const decideRoleApplicationSchema = z.object({
  status: roleApplicationDecisionSchema,
});

export type MembersTableQuery = z.infer<typeof membersTableQuerySchema>;
export type RolesTableQuery = z.infer<typeof rolesTableQuerySchema>;
export type AssignmentsTableQuery = z.infer<typeof assignmentsTableQuerySchema>;
export type RoleApplicationsTableQuery = z.infer<
  typeof roleApplicationsTableQuerySchema
>;
