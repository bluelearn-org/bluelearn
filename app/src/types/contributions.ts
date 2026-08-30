import { z } from "zod";

// Schemas are only used to check drafts restored from localStorage. Doesn't use shared
// schemas because an empty field here is "" not null.
export const contributionTypeSchema = z.enum(["guide", "variant", "objective"]);

const disclaimerSlugSchema = z.enum([
  "medical",
  "financial",
  "legal",
  "mature",
  "profanity",
]);

const newSubjectSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  summary: z.string(),
});

export const guideContributionSchema = z.object({
  type: z.string(),
  title: z.string(),
  summary: z.string(),
  body: z.string(),
  subjects: z.array(z.string()),
  newSubjects: z.array(newSubjectSchema),
  prereqs: z.array(z.string()),
  todoPrereqs: z.array(z.object({ title: z.string(), summary: z.string() })),
  disclaimers: z.array(disclaimerSlugSchema),
});

export const variantContributionSchema = z.object({
  type: z.string(),
  title: z.string(),
  summary: z.string(),
  baseGuide: z.string(),
  subjects: z.array(z.string()),
  newSubjects: z.array(newSubjectSchema),
  body: z.string(),
});

export const subObjectiveSchema = z.object({
  targetSlug: z.string(),
  selectedSlugs: z.array(z.string()),
  curatedSequence: z.array(z.string()),
});

export const objectiveContributionSchema = z.object({
  title: z.string(),
  summary: z.string(),
  changeSummary: z.string(),
  targets: z.array(z.string()),
  featuredSubObjective: z.string(),
  subObjectives: z.array(subObjectiveSchema),
  subjects: z.array(z.string()),
});

export type ContributionType = z.infer<typeof contributionTypeSchema>;
export type GuideContribution = z.infer<typeof guideContributionSchema>;
export type VariantContribution = z.infer<typeof variantContributionSchema>;
export type SubObjective = z.infer<typeof subObjectiveSchema>;
export type ObjectiveContribution = z.infer<typeof objectiveContributionSchema>;
