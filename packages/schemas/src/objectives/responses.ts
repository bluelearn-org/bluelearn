import { z } from "zod";
import { subjectReferenceSchema } from "../subjects";
import { guideReferenceSchema } from "../guides/references";

export const objectiveNodeSchema = z.object({
  guide: guideReferenceSchema,
  level: z.number().int(),
  is_target: z.boolean(),
  is_included: z.boolean(),
  note: z.string().nullable(),
  word_count: z.number().int(),
});

// A prerequisite edge between two nodes.
export const objectiveEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
});

// A objective's metadata, the leveled nodes, and the edges. word_count
// is the sum over included nodes the client turns into total reading time.
export const objectiveSchema = z.object({
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  curator: z.string(),
  created_at: z.iso.datetime(),
  word_count: z.number().int(),
  tags: z.array(subjectReferenceSchema),
  nodes: z.array(objectiveNodeSchema),
  edges: z.array(objectiveEdgeSchema),
});

// One featured node: a guide the curator placed under the featured target, in
// placement order.
export const featuredNodeSchema = z.object({
  position: z.number().int(),
  slug: z.string().nullable(),
  title: z.string().nullable(),
});

// An objective as listed anywhere it renders as a card (GET /objectives,
// subject pages). duration_minutes sums the included guides' reading time.
export const objectiveListItemSchema = z.object({
  id: z.uuid(),
  slug: z.string().nullable(),
  title: z.string().nullable(),
  summary: z.string().nullable(),
  curator: z.string().nullable(),
  created_at: z.iso.datetime(),
  guides_total: z.number().int(),
  duration_minutes: z.number().int(),
  featured_sub_objective: z.array(featuredNodeSchema),
});

export type ObjectiveNode = z.infer<typeof objectiveNodeSchema>;
export type ObjectiveEdge = z.infer<typeof objectiveEdgeSchema>;
export type Objective = z.infer<typeof objectiveSchema>;
export type FeaturedNode = z.infer<typeof featuredNodeSchema>;
export type ObjectiveListItem = z.infer<typeof objectiveListItemSchema>;
