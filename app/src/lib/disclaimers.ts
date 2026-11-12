import { disclaimerSlugs } from "@bluelearn/schemas";
import type { DisclaimerSlug } from "@bluelearn/schemas";

// Keyed by slug so adding a disclaimer to the schema fails to compile until it
// gets a label here.
const DISCLAIMER_LABELS: Record<DisclaimerSlug, string> = {
  medical: "Medical",
  financial: "Financial",
  legal: "Legal",
  mature: "Mature age-restricted 18+ content",
  profanity: "Profanity",
};

export const disclaimerLabel = (slug: DisclaimerSlug) =>
  DISCLAIMER_LABELS[slug];

export const DISCLAIMER_OPTIONS = disclaimerSlugs.map((value) => ({
  value,
  label: DISCLAIMER_LABELS[value],
}));

// Banner copy shown on the guide. Slugs without an entry show no banner.
export const DISCLAIMER_TEXTS: Partial<Record<DisclaimerSlug, string>> = {
  medical:
    "This article is for informational purposes only and does not constitute medical advice. Always consult a qualified healthcare provider for diagnosis and treatment recommendations.",
  legal:
    "This information is provided for general informational purposes only and does not constitute legal advice. Reading this content does not create an attorney-client relationship.",
  financial:
    "This material is for informational purposes only and is not investment, financial, or tax advice. Consult a qualified financial advisor before making decisions. Past performance is not indicative of future results.",
};
