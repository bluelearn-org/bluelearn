import { z } from "zod";

import {
  reviewCaseStatusSchema,
  reviewCaseTypeSchema,
  reviewOutcomeSchema,
  reviewSeatStatusSchema,
} from "./enums";

export const reviewCaseListItemSchema = z.object({
  id: z.string(),
  case_type: reviewCaseTypeSchema,
  status: reviewCaseStatusSchema,
  title: z.string().nullable(),
  created_at: z.string(),
});

export const reviewQueueItemSchema = reviewCaseListItemSchema.extend({
  decision: reviewOutcomeSchema.nullable(),
  expires_at: z.string().nullable(),
});

export const reviewCaseDetailSchema = z.object({
  id: z.string(),
  case_type: reviewCaseTypeSchema,
  status: reviewCaseStatusSchema,
  title: z.string().nullable(),
  created_by: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const reviewDecisionSchema = z.object({
  id: z.string(),
  decision: reviewOutcomeSchema,
  notes: z.string().nullable(),
  reasons: z.array(z.string()),
  created_at: z.string(),
});

export const reviewCaseDetailResponseSchema = z.strictObject({
  case: reviewCaseDetailSchema,
  panel: z.array(
    z.object({
      id: z.string(),
      member_id: z.string().nullable(),
      status: reviewSeatStatusSchema,
      assigned_at: z.string(),
      expires_at: z.string().nullable(),
    })
  ),
  decisions: z.array(
    z.object({
      id: z.string(),
      decision: z.string(),
      notes: z.string().nullable(),
      reasons: z.array(z.string()),
      created_at: z.string(),
    })
  ),
  viewer_role: z.enum(["author", "panelist", "public"]),
  viewer_decision: z
    .object({
      id: z.string(),
      decision: reviewOutcomeSchema,
      notes: z.string().nullable(),
      reasons: z.array(z.string()),
      created_at: z.string(),
    })
    .nullable(),
  viewer_seat_status: reviewSeatStatusSchema.nullable(),
  viewer_expires_at: z.string().nullable(),
  revise_draft_id: z.string().nullable(),
  revision: z
    .object({
      id: z.string(),
      title: z.string().nullable(),
      summary: z.string().nullable(),
      body: z.string().nullable(),
      status: z.string(),
      created_at: z.string(),
    })
    .nullable(),
  prerequisites: z.array(
    z.object({
      slug: z.string(),
      title: z.string().nullable().optional(),
    })
  ),
  todos: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
    })
  ),
  claimed_todos: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      summary: z.string(),
      requested_by: z
        .object({ slug: z.string(), title: z.string().nullable() })
        .nullable(),
    })
  ),
});

export const reviewQueueResponseSchema = z.strictObject({
  cases: z.array(reviewQueueItemSchema),
  total: z.number().int().min(0),
});

export const reviewCaseListResponseSchema = z.strictObject({
  cases: z.array(reviewCaseListItemSchema),
});

export const reviewDecisionResponseSchema = z.strictObject({
  decision: reviewDecisionSchema,
});

export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;
export type ReviewCaseListItem = z.infer<typeof reviewCaseListItemSchema>;
export type ReviewQueueItem = z.infer<typeof reviewQueueItemSchema>;
export type ReviewCaseDetail = z.infer<typeof reviewCaseDetailSchema>;
export type ReviewCaseDetailResponse = z.infer<
  typeof reviewCaseDetailResponseSchema
>;
