import { z } from "zod";

// Schemas are only used to check drafts restored from localStorage. Doesn't use shared
// schemas because an empty field here is "" not null.
export const contributionTypeSchema = z.enum(["guide", "variant", "objective"]);
export const guideTypeSchema = z.enum(["theoretical", "practical"]);

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
  type: guideTypeSchema,
  title: z.string(),
  summary: z.string(),
  body: z.string(),
  subjects: z.array(z.string()),
  newSubjects: z.array(newSubjectSchema),
  prereqs: z.array(z.string()),
  requests: z.array(z.object({ title: z.string(), summary: z.string() })),
  disclaimers: z.array(disclaimerSlugSchema),
});

export const variantContributionSchema = z.object({
  type: guideTypeSchema,
  title: z.string(),
  summary: z.string(),
  baseGuide: z.string(),
  subjects: z.array(z.string()),
  newSubjects: z.array(newSubjectSchema),
  body: z.string(),
  disclaimers: z.array(disclaimerSlugSchema),
});

export const subObjectiveSchema = z.object({
  targetSlug: z.string(),
  selectedSlugs: z.array(z.string()),
  curatedSequence: z.array(z.string()),
});

// The design canvas draft. Positions are not stored: the layout computes them
// from the edges, so an edge is always prerequisite (source) -> dependent (target).
export const objectiveGraphNodeSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    type: z.enum(["guide", "target"]),
    guideSlug: z.string(),
    title: z.string(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("guide_request"),
    title: z.string(),
    summary: z.string(),
  }),
]);

export const objectiveGraphEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
});

export const objectiveGraphSchema = z.object({
  nodes: z.array(objectiveGraphNodeSchema),
  edges: z.array(objectiveGraphEdgeSchema),
});

export const objectiveContributionSchema = z.object({
  title: z.string(),
  summary: z.string(),
  changeSummary: z.string(),
  targets: z.array(z.string()),
  featuredSubObjective: z.string(),
  subObjectives: z.array(subObjectiveSchema),
  subjects: z.array(z.string()),
  // Drafts stored before the canvas existed have no graph.
  graph: objectiveGraphSchema.default({ nodes: [], edges: [] }),
});

export type ContributionType = z.infer<typeof contributionTypeSchema>;
export type GuideType = z.infer<typeof guideTypeSchema>;
export type GuideContribution = z.infer<typeof guideContributionSchema>;
export type VariantContribution = z.infer<typeof variantContributionSchema>;
export type SubObjective = z.infer<typeof subObjectiveSchema>;
export type ObjectiveContribution = z.infer<typeof objectiveContributionSchema>;
export type ObjectiveGraphNode = z.infer<typeof objectiveGraphNodeSchema>;
export type ObjectiveGraphEdge = z.infer<typeof objectiveGraphEdgeSchema>;
export type ObjectiveGraphData = z.infer<typeof objectiveGraphSchema>;
