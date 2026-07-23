import { z } from "zod";

import {
  reviewCaseStatusSchema,
  reviewCaseTypeSchema,
  reviewOutcomeSchema,
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

export const reviewCaseDetailResponseSchema = z.object({
  case: reviewCaseDetailSchema,
  panel: z.array(
    z.object({
      id: z.string(),
      member_id: z.string().nullable(),
      status: z.string(),
      assigned_at: z.string(),
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
});

export type ReviewCaseListItem = z.infer<typeof reviewCaseListItemSchema>;
export type ReviewQueueItem = z.infer<typeof reviewQueueItemSchema>;
export type ReviewCaseDetail = z.infer<typeof reviewCaseDetailSchema>;
export type ReviewCaseDetailResponse = z.infer<
  typeof reviewCaseDetailResponseSchema
>;
