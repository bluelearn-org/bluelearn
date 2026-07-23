import { z } from "zod";

export const reviewCaseStatusSchema = z.enum([
  "pending",
  "in_review",
  "approved",
  "rejected",
]);

export const reviewCaseTypeSchema = z.enum(["guide_publish", "guide_edit"]);

export const reviewOutcomeSchema = z.enum(["approved", "rejected"]);

export const decisionReasonSchema = z.enum([
  "hierarchy_issue",
  "factual_error",
  "duplicate_content",
  "scope_violation",
  "clarity_issue",
  "missing_required_information",
]);

export type ReviewCaseStatus = z.infer<typeof reviewCaseStatusSchema>;
export type ReviewCaseType = z.infer<typeof reviewCaseTypeSchema>;
export type ReviewOutcome = z.infer<typeof reviewOutcomeSchema>;
export type DecisionReason = z.infer<typeof decisionReasonSchema>;
