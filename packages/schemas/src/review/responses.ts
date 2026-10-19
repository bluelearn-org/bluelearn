import { z } from "zod";

import { fieldDiffSchema } from "../diff";
import {
  reviewAnchorKindSchema,
  reviewCaseStatusSchema,
  reviewCaseTypeSchema,
  reviewOutcomeSchema,
  reviewSeatStatusSchema,
  reviewSuggestionStatusSchema,
} from "./enums";

export const reviewCaseListItemSchema = z.object({
  id: z.string(),
  case_type: reviewCaseTypeSchema,
  status: reviewCaseStatusSchema,
  title: z.string().nullable(),
  is_variant: z.boolean(),
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
      is_variant: z.boolean(),
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

export const reviewParticipantSchema = z.object({
  id: z.string(),
  username: z.string(),
  display_name: z.string().nullable(),
  role: z.enum(["author", "panelist"]),
});

// source_text is the server's slice of the revision body, never client text.
export const reviewAnchorSchema = z.object({
  kind: reviewAnchorKindSchema,
  start_block: z.number().int(),
  start_offset: z.number().int(),
  end_block: z.number().int(),
  end_offset: z.number().int(),
  quote: z.string(),
  source_start: z.number().int().nullable(),
  source_end: z.number().int().nullable(),
  source_text: z.string().nullable(),
});

// "outdated" feedback is listed with its quote and never re-placed in the text.
export const reviewAnchorStatusSchema = z.enum(["current", "outdated"]);

export const reviewThreadReplySchema = z.object({
  id: z.string(),
  author: reviewParticipantSchema.nullable(),
  body: z.string(),
  created_at: z.string(),
});

export const reviewThreadSchema = z.object({
  id: z.string(),
  revision_id: z.string(),
  anchor: reviewAnchorSchema,
  anchor_status: reviewAnchorStatusSchema,
  author: reviewParticipantSchema.nullable(),
  body: z.string(),
  created_at: z.string(),
  replies: z.array(reviewThreadReplySchema),
});

export const reviewSuggestionSchema = z.object({
  id: z.string(),
  revision_id: z.string(),
  anchor: reviewAnchorSchema,
  anchor_status: reviewAnchorStatusSchema,
  author: reviewParticipantSchema.nullable(),
  note: z.string().nullable(),
  original: z.string(),
  proposed: z.string(),
  diff: fieldDiffSchema,
  status: reviewSuggestionStatusSchema,
  decided_by: reviewParticipantSchema.nullable(),
  decided_at: z.string().nullable(),
  applied_revision_id: z.string().nullable(),
  created_at: z.string(),
});

export const reviewPermissionsSchema = z.object({
  can_comment: z.boolean(),
  can_reply: z.boolean(),
  can_suggest: z.boolean(),
  can_decide_suggestions: z.boolean(),
});

// An approving majority publishes only once no suggestion is pending.
export const reviewPublicationSchema = z.object({
  pending_suggestions: z.number().int().min(0),
  accepted_suggestions: z.number().int().min(0),
  awaiting_author: z.boolean(),
  published_revision_id: z.string().nullable(),
});

export const reviewAnnotationsResponseSchema = z.strictObject({
  case_id: z.string(),
  case_status: reviewCaseStatusSchema,
  revision_id: z.string().nullable(),
  viewer_role: z.enum(["author", "panelist", "public"]),
  permissions: reviewPermissionsSchema,
  publication: reviewPublicationSchema,
  threads: z.array(reviewThreadSchema),
  suggestions: z.array(reviewSuggestionSchema),
});

export const reviewThreadResponseSchema = z.strictObject({
  thread: reviewThreadSchema,
});

export const reviewThreadReplyResponseSchema = z.strictObject({
  reply: reviewThreadReplySchema,
});

export const reviewSuggestionResponseSchema = z.strictObject({
  suggestion: reviewSuggestionSchema,
});

export const reviewSuggestionDecisionResponseSchema = z.strictObject({
  suggestion: reviewSuggestionSchema,
  case_status: reviewCaseStatusSchema,
  publication: reviewPublicationSchema,
});

export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;
export type ReviewCaseListItem = z.infer<typeof reviewCaseListItemSchema>;
export type ReviewQueueItem = z.infer<typeof reviewQueueItemSchema>;
export type ReviewCaseDetail = z.infer<typeof reviewCaseDetailSchema>;
export type ReviewCaseDetailResponse = z.infer<
  typeof reviewCaseDetailResponseSchema
>;
export type ReviewParticipant = z.infer<typeof reviewParticipantSchema>;
export type ReviewAnchor = z.infer<typeof reviewAnchorSchema>;
export type ReviewAnchorStatus = z.infer<typeof reviewAnchorStatusSchema>;
export type ReviewThreadReply = z.infer<typeof reviewThreadReplySchema>;
export type ReviewThread = z.infer<typeof reviewThreadSchema>;
export type ReviewSuggestion = z.infer<typeof reviewSuggestionSchema>;
export type ReviewPermissions = z.infer<typeof reviewPermissionsSchema>;
export type ReviewPublication = z.infer<typeof reviewPublicationSchema>;
export type ReviewAnnotationsResponse = z.infer<
  typeof reviewAnnotationsResponseSchema
>;
