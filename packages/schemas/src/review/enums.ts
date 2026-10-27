import { z } from "zod";

export const reviewCaseStatusSchema = z.enum([
  "pending",
  "in_review",
  "approved",
  "rejected",
]);

export const reviewCaseTypeSchema = z.enum([
  "guide_publish",
  "guide_edit",
  "official_publish",
  "official_edit",
]);

export const reviewOutcomeSchema = z.enum(["approved", "rejected"]);

export const reviewSeatStatusSchema = z.enum([
  "assigned",
  "recused",
  "replaced",
  "completed",
]);

export const decisionReasonSchema = z.enum([
  "hierarchy_issue",
  "factual_error",
  "duplicate_content",
  "scope_violation",
  "clarity_issue",
  "missing_required_information",
]);

// "passage" is a text selection; "block" is a whole top-level block, the path
// for keyboards, screen readers, and images.
export const reviewAnchorKindSchema = z.enum(["passage", "block"]);

export const reviewSuggestionStatusSchema = z.enum([
  "pending",
  "accepted",
  "rejected",
]);

export type ReviewCaseStatus = z.infer<typeof reviewCaseStatusSchema>;
export type ReviewCaseType = z.infer<typeof reviewCaseTypeSchema>;
export type ReviewOutcome = z.infer<typeof reviewOutcomeSchema>;
export type ReviewSeatStatus = z.infer<typeof reviewSeatStatusSchema>;
export type DecisionReason = z.infer<typeof decisionReasonSchema>;
export type ReviewAnchorKind = z.infer<typeof reviewAnchorKindSchema>;
export type ReviewSuggestionStatus = z.infer<
  typeof reviewSuggestionStatusSchema
>;
