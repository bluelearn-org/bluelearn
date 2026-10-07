import { z } from "zod";

export const roleSchema = z.enum(["verifier", "moderator", "admin"]);

// Roles a member may apply for. admin, curator and official stay granted
// directly by an admin.
export const applicableRoleSchema = z.enum(["verifier", "moderator"]);

export const roleApplicationStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
]);

export const roleApplicationDecisionSchema = z.enum(["approved", "rejected"]);

export const activityContentKindSchema = z.enum([
  "guide",
  "objective",
  "review",
]);

export const activityStatusSchema = z.enum([
  "draft",
  "submitted",
  "pending",
  "in_review",
  "approved",
  "rejected",
  "published",
]);

export const activityTypeFilterSchema = z.enum([
  "guide_creation",
  "guide_revision",
  "variant_creation",
  "variant_revision",
  "objective_creation",
  "objective_revision",
  "review",
]);

export const activityStatusFilterSchema = z.enum([
  "draft",
  "in_review",
  "published",
  "rejected",
]);

export const activitySortSchema = z.enum([
  "title_asc",
  "title_desc",
  "summary_asc",
  "summary_desc",
  "date_asc",
]);

export type Role = z.infer<typeof roleSchema>;
export type ApplicableRole = z.infer<typeof applicableRoleSchema>;
export type RoleApplicationStatus = z.infer<typeof roleApplicationStatusSchema>;
export type RoleApplicationDecision = z.infer<
  typeof roleApplicationDecisionSchema
>;
export type ActivityContentKind = z.infer<typeof activityContentKindSchema>;
export type ActivityStatus = z.infer<typeof activityStatusSchema>;
export type ActivityTypeFilter = z.infer<typeof activityTypeFilterSchema>;
export type ActivityStatusFilter = z.infer<typeof activityStatusFilterSchema>;
export type ActivitySort = z.infer<typeof activitySortSchema>;
