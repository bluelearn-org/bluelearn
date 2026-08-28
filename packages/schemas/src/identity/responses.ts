import { z } from "zod";
import {
  activityContentKindSchema,
  activityStatusSchema,
  roleSchema,
} from "./enums";

export const contributorSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string().nullable(),
});

export type Contributor = z.infer<typeof contributorSchema>;

export const profileSchema = z.object({
  id: z.uuid(),
  username: z.string(),
  display_name: z.string().nullable(),
  bio: z.string().nullable(),
  is_suspended: z.boolean(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});

export const publicProfileSchema = z.object({
  id: z.uuid(),
  username: z.string(),
  display_name: z.string().nullable(),
  bio: z.string().nullable(),
  created_at: z.iso.datetime({ offset: true }),
});

export const guideDraftSchema = z.object({
  revision_id: z.uuid(),
  guide_id: z.uuid(),
  title: z.string(),
  guide_slug: z.string().nullable(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});

export const objectiveDraftSchema = z.object({
  revision_id: z.uuid(),
  objective_id: z.uuid(),
  title: z.string(),
  objective_slug: z.string().nullable(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});

export const profileStatsSchema = z.object({
  upvotes: z.number().int(),
  downvotes: z.number().int(),
  contributions: z.number().int(),
  reviews: z.number().int(),
});

export const profileActivityItemSchema = z.object({
  content_kind: activityContentKindSchema,
  is_variant: z.boolean(),
  is_creation: z.boolean(),
  title: z.string(),
  change_summary: z.string().nullable(),
  created_at: z.iso.datetime({ offset: true }),
  status: activityStatusSchema,
  target_slug: z.string().nullable(),
  base_slug: z.string().nullable(),
  review_case_id: z.uuid().nullable(),
  revision_id: z.uuid().nullable(),
});

export const meResponseSchema = z.strictObject({
  profile: profileSchema,
  email: z.string().nullable(),
  roles: z.array(roleSchema),
});

export const myDraftsResponseSchema = z.strictObject({
  guide_drafts: z.array(guideDraftSchema),
  objective_drafts: z.array(objectiveDraftSchema),
});

export const profilePageResponseSchema = z.strictObject({
  profile: publicProfileSchema,
  roles: z.array(roleSchema),
  stats: profileStatsSchema,
  activity: z.array(profileActivityItemSchema),
  is_owner: z.boolean(),
});

export type Profile = z.infer<typeof profileSchema>;
export type PublicProfile = z.infer<typeof publicProfileSchema>;
export type GuideDraft = z.infer<typeof guideDraftSchema>;
export type ObjectiveDraft = z.infer<typeof objectiveDraftSchema>;
export type ProfileStats = z.infer<typeof profileStatsSchema>;
export type ProfileActivityItem = z.infer<typeof profileActivityItemSchema>;
