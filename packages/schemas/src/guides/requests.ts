import { z } from "zod";
import {
  guideBodySchema,
  guideChangeSummarySchema,
  guideSlugSchema,
  guideSummarySchema,
  guideTitleSchema,
} from "./fields";
import { subjectNameSchema, subjectSummarySchema } from "../subjects";
import {
  disclaimerSchema,
  downvoteReasonSchema,
  knowledgeTypeSchema,
  voteDirectionSchema,
} from "./enums";

// The editable content of a revision.
const revisionContentSchema = z.object({
  title: guideTitleSchema,
  summary: guideSummarySchema.nullish(),
  body: guideBodySchema.nullish(),
});

export const newSubjectSchema = z.object({
  name: subjectNameSchema,
  summary: subjectSummarySchema.nullish(),
});

export const requestSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(50, "Title must be 50 characters or less"),
  summary: z
    .string()
    .trim()
    .min(1, "Summary is required")
    .max(500, "Summary must be 500 characters or less"),
});

export const createGuideSchema = z
  .object({
    knowledge_type: knowledgeTypeSchema.default("theoretical"),
    title: guideTitleSchema.nullish(),
    summary: guideSummarySchema.nullish(),
    body: guideBodySchema.nullish(),
    tags: z.array(z.uuid()).default([]),
    prerequisites: z.array(guideSlugSchema).default([]),
    newSubjects: z.array(newSubjectSchema).default([]),
    requests: z.array(requestSchema).optional(),
    requestClaims: z.array(z.uuid()).optional(),
    // Older tabs still send these names. Keep accepting them during the rename.
    todoPrereqs: z.array(requestSchema).optional(),
    todoClaims: z.array(z.uuid()).optional(),
    disclaimers: z.array(disclaimerSchema).default([]),
  })
  .transform(({ todoPrereqs, todoClaims, ...guide }) => ({
    ...guide,
    requests: guide.requests ?? todoPrereqs ?? [],
    requestClaims: guide.requestClaims ?? todoClaims ?? [],
  }));

// A variant starts as a draft like a guide does, so every field here is optional
// and completeness is checked at submit. Its own slug is assigned at publish.
export const createVariantSchema = revisionContentSchema.extend({
  title: guideTitleSchema.nullish(),
  tags: z.array(z.uuid()).default([]),
  newSubjects: z.array(newSubjectSchema).default([]),
});

// Edits to a draft revision before it goes for review. Send only the fields you
// want to change (at least one is required).
export const updateRevisionSchema = revisionContentSchema
  .extend({
    title: guideTitleSchema.nullish(),
    change_summary: guideChangeSummarySchema.nullish(),
    tags: z.array(z.uuid()),
    prerequisites: z.array(guideSlugSchema),
    newSubjects: z.array(newSubjectSchema),
    requests: z.array(requestSchema),
    todoPrereqs: z.array(requestSchema),
    disclaimers: z.array(disclaimerSchema),
  })
  .partial()
  .transform(({ todoPrereqs, ...revision }) => ({
    ...revision,
    ...(revision.requests !== undefined || todoPrereqs !== undefined
      ? { requests: revision.requests ?? todoPrereqs }
      : {}),
  }))
  .refine((v) => Object.keys(v).length > 0, {
    message: "at least one field is required",
  });

// reason is required if the direction is down.
export const castVoteSchema = z
  .object({
    direction: voteDirectionSchema,
    reason: downvoteReasonSchema.nullish(),
    note: z.string().trim().nullish(),
  })
  .refine((v) => (v.direction === "down") === (v.reason != null), {
    message: "reason is required on a downvote and forbidden otherwise",
    path: ["reason"],
  });

export const rollbackRevisionSchema = z.object({
  revision_id: z.uuid(),
});

export type RequestInput = z.infer<typeof requestSchema>;
export type CreateGuideInput = z.infer<typeof createGuideSchema>;
export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateRevisionInput = z.infer<typeof updateRevisionSchema>;
export type CastVoteInput = z.infer<typeof castVoteSchema>;
export type RollbackRevisionInput = z.infer<typeof rollbackRevisionSchema>;
