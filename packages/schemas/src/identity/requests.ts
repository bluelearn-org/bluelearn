import { z } from "zod";
import { bioSchema, displayNameSchema, usernameSchema } from "./fields";
import {
  activitySortSchema,
  activityStatusFilterSchema,
  activityTypeFilterSchema,
  applicableRoleSchema,
} from "./enums";

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

const filterList = <T extends string>(schema: z.ZodType<T>) =>
  z
    .union([z.string(), z.array(z.string())])
    .transform((value) => {
      const kept = (Array.isArray(value) ? value : [value]).filter(
        (item): item is T => schema.safeParse(item).success
      );
      return kept.length > 0 ? kept : undefined;
    })
    .optional()
    .catch(undefined);

export const profileActivitySearchSchema = z.object({
  type: filterList(activityTypeFilterSchema),
  status: filterList(activityStatusFilterSchema),
  subject: filterList(z.string().min(1)),
  title: z.string().min(1).optional().catch(undefined),
  summary: z.string().min(1).optional().catch(undefined),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
  sort: activitySortSchema.optional().catch(undefined),
  page: z.coerce.number().int().min(2).optional().catch(undefined),
});

export type ProfileActivitySearch = z.infer<typeof profileActivitySearchSchema>;
export type ActivityFilters = Omit<ProfileActivitySearch, "page">;

export const createRoleApplicationSchema = z.object({
  role: applicableRoleSchema,
  // An optional note to the admins: why this member, why now.
  statement: z.string().trim().min(1).max(2000).nullish(),
});

export type CreateRoleApplicationInput = z.infer<
  typeof createRoleApplicationSchema
>;
