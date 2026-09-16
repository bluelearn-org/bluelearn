export type ReviewDecisionInput = {
  decision: string;
  notes: string;
  reasons: Array<string>;
};

// Any letter or number in any script counts, so notes are not limited to Latin
// characters. Whitespace and bare punctuation are not a note.
const MEANINGFUL_TEXT = /[\p{L}\p{N}]/u;

export function hasMeaningfulText(value: string): boolean {
  return MEANINGFUL_TEXT.test(value);
}

/**
 * Describes what is stopping a decision from being submitted, or returns an
 * empty string when it is ready to go.
 */
export function validateReviewDecision(review: ReviewDecisionInput): string {
  if (review.decision === "")
    return "Choose approve or reject before submitting";
  if (review.decision === "approve") return "";

  const missing = [];
  if (review.reasons.length === 0) missing.push("at least one reason");
  if (!hasMeaningfulText(review.notes)) missing.push("a note");

  return missing.length === 0
    ? ""
    : `Rejections require ${missing.join(" and ")}`;
}
