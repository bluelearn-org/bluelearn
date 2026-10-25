import { z } from "zod";
import { bioSchema, displayNameSchema, usernameSchema } from "./fields";
import {
  activitySortSchema,
  activityStatusFilterSchema,
  activityTypeFilterSchema,
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

export const deleteDraftsSchema = z
  .object({
    guide_revision_ids: z.array(z.uuid()).max(100),
    objective_revision_ids: z.array(z.uuid()).max(100),
  })
  .refine(
    ({ guide_revision_ids, objective_revision_ids }) => {
      const count = guide_revision_ids.length + objective_revision_ids.length;
      return count > 0 && count <= 100;
    },
    { message: "Select between 1 and 100 drafts" }
  )
  .refine(
    ({ guide_revision_ids, objective_revision_ids }) =>
      new Set(guide_revision_ids).size === guide_revision_ids.length &&
      new Set(objective_revision_ids).size === objective_revision_ids.length,
    { message: "Each draft must appear only once" }
  );

export type DeleteDraftsInput = z.infer<typeof deleteDraftsSchema>;

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
