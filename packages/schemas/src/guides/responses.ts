import { z } from "zod";
import {
  subjectReferenceSchema,
  subjectTagSchema,
} from "../subjects/references";
import { contributorSchema } from "../identity/responses";
import { fieldDiffSchema, revisionRefSchema } from "../diff";
import {
  downvoteReasonSchema,
  guideStatusSchema,
  knowledgeTypeSchema,
  revisionStatusSchema,
  voteDirectionSchema,
} from "./enums";
import { guideReferenceSchema } from "./references";
export const guideSchema = z.object({
  slug: z.string(),
  variant_id: z.string().nullable(),
  variant_slug: z.string().nullable(),
  title: z.string(),
  author: z.string().nullable(),
  knowledge_type: knowledgeTypeSchema,
  summary: z.string().nullable(),
  body: z.string().nullable(),
  duration_minutes: z.number().int(),
  created_at: z.iso.datetime({ offset: true }),
  tags: z.array(subjectReferenceSchema),
  prerequisites: z.array(guideReferenceSchema),
  is_official: z.boolean(),
});
export const walkthroughSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.uuid(),
      slug: z.string(),
      title: z.string(),
      summary: z.string().nullable(),
      level: z.number().int(),
      duration_minutes: z.number().int(),
      tags: z.array(subjectReferenceSchema),
    })
  ),
  edges: z.array(
    z.object({
      from_id: z.uuid(),
      to_id: z.uuid(),
    })
  ),
});
export const guideListItemSchema = z.object({
  id: z.uuid(),
  slug: z.string().nullable(),
  title: z.string().nullable(),
  knowledge_type: knowledgeTypeSchema,
  summary: z.string().nullable(),
  status: guideStatusSchema,
  created_at: z.iso.datetime({ offset: true }),
  author: z.string().nullable(),
  duration_minutes: z.number().int(),
  tags: z.array(subjectReferenceSchema),
  is_official: z.boolean(),
});
export type Guide = z.infer<typeof guideSchema>;
export type GuideListItem = z.infer<typeof guideListItemSchema>;
export type Walkthrough = z.infer<typeof walkthroughSchema>;
export const guideVariantListItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  is_canonical: z.boolean(),
  author: z.string().nullable(),
  updated_at: z.string().nullable(),
  votes: z.object({ up: z.number(), down: z.number() }),
});
export type GuideVariantListItem = z.infer<typeof guideVariantListItemSchema>;
export const guideObjectiveListItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  author: z.string().nullable(),
  updated_at: z.string().nullable(),
});
export type GuideObjectiveListItem = z.infer<
  typeof guideObjectiveListItemSchema
>;
export const guideContributorSchema = contributorSchema;
export type GuideContributor = z.infer<typeof guideContributorSchema>;
export const guideRevisionListItemSchema = z.object({
  id: z.string(),
  status: z.literal("approved"),
  change_summary: z.string().nullable(),
  created_at: z.string(),
  approved_at: z.string().nullable(),
  author: z.string().nullable(),
});
export type GuideRevisionListItem = z.infer<typeof guideRevisionListItemSchema>;

const totalSchema = z.number().int().min(0);

export const guideVotesSchema = z.object({
  up: z.number().int(),
  down: z.number().int(),
});

export const variantSchema = z.object({
  id: z.uuid(),
  guide_base_id: z.uuid(),
  slug: z.string().nullable(),
  status: guideStatusSchema,
  current: z
    .object({
      id: z.uuid(),
      title: z.string().nullable(),
      summary: z.string().nullable(),
      body: z.string().nullable(),
      created_at: z.iso.datetime({ offset: true }),
    })
    .nullable(),
  votes: guideVotesSchema,
});

export const voteSchema = z.object({
  guide_id: z.uuid(),
  direction: voteDirectionSchema,
  reason: downvoteReasonSchema.optional(),
  note: z.string().nullable(),
  updated_at: z.iso.datetime({ offset: true }),
});

export const guideRevisionSchema = z.object({
  id: z.uuid(),
  guide_id: z.uuid(),
  title: z.string().nullable(),
  summary: z.string().nullable(),
  body: z.string().nullable(),
  change_summary: z.string().nullable(),
  status: revisionStatusSchema,
  created_at: z.iso.datetime({ offset: true }),
});

export const archivedNodeSchema = z.object({
  id: z.uuid(),
  slug: z.string().nullable(),
  status: guideStatusSchema,
});

export const guideListResponseSchema = z.strictObject({
  guides: z.array(guideListItemSchema),
  total: totalSchema,
});

export const revisionIdResponseSchema = z.strictObject({
  revision_id: z.uuid(),
});

export const archivedGuideResponseSchema = z.strictObject({
  guide: archivedNodeSchema,
});

export const guideVariantListResponseSchema = z.strictObject({
  variants: z.array(guideVariantListItemSchema),
  total: totalSchema,
});

export const guideObjectiveListResponseSchema = z.strictObject({
  objectives: z.array(guideObjectiveListItemSchema),
  total: totalSchema,
});

export const variantResponseSchema = z.strictObject({
  variant: variantSchema,
});

export const archivedVariantResponseSchema = z.strictObject({
  variant: archivedNodeSchema,
});

export const voteResponseSchema = z.strictObject({
  vote: voteSchema,
});

export const myVoteResponseSchema = z.strictObject({
  vote: voteSchema.nullable(),
});

export const contributorsResponseSchema = z.strictObject({
  contributors: z.array(contributorSchema),
});

export const guideRevisionListResponseSchema = z.strictObject({
  revisions: z.array(guideRevisionListItemSchema),
  total: totalSchema,
});

export const guideRevisionDetailResponseSchema = z.strictObject({
  revision: guideRevisionSchema,
  subjects: z.array(subjectTagSchema),
  knowledge_type: knowledgeTypeSchema.nullable(),
  is_variant: z.boolean(),
  base_slug: z.string().nullable(),
  variant_slug: z.string().nullable(),
  prerequisites: z.array(z.string()),
  todos: z.array(z.object({ title: z.string(), summary: z.string() })),
  revised_from_case_id: z.uuid().nullable(),
});

export const guideRevisionUpdateResponseSchema = z.strictObject({
  revision: guideRevisionSchema,
  subjects: z.array(subjectTagSchema),
});

export const reviewCaseIdResponseSchema = z.strictObject({
  review_case_id: z.uuid(),
});

export const guideRevisionDiffResponseSchema = z.strictObject({
  from: revisionRefSchema,
  to: revisionRefSchema,
  fields: z.object({
    title: fieldDiffSchema,
    summary: fieldDiffSchema,
    body: fieldDiffSchema,
  }),
});

export type Variant = z.infer<typeof variantSchema>;
export type Vote = z.infer<typeof voteSchema>;
export type GuideRevision = z.infer<typeof guideRevisionSchema>;
