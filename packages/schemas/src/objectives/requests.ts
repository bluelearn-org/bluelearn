import { z } from "zod";
import {
  objectiveChangeSummarySchema,
  objectiveSummarySchema,
  objectiveTitleSchema,
} from "./fields";

// Create a draft objective. Title is optional at creation and only required to
// publish; the targets come later, from the graph.
export const createObjectiveSchema = z.object({
  title: objectiveTitleSchema.nullish(),
  summary: objectiveSummarySchema.nullish(),
  tags: z.array(z.uuid()).default([]),
});

// One goal in the objective's curation, named by its node. The server derives
// which nodes are targets from the graph; this only orders and features them.
// Position comes from the array index, so the client sends targets in the order
// it wants them. `sequence` is the topics placed under this goal in reading
// order; leaving it off every target means the curation under it did not change.
export const objectiveTargetSchema = z.object({
  node_id: z.uuid(),
  is_featured: z.boolean().default(false),
  sequence: z.array(z.uuid()).optional(),
});

// The drawn graph, sent whole. Node ids are minted by the client so an edge in
// the same body can name a node the server has not stored yet. A guide node is
// matched by its guide base; a request node is kept under its own id.
export const objectiveGraphGuideNodeSchema = z.object({
  id: z.uuid(),
  guide_base_id: z.uuid(),
});

export const objectiveGraphRequestNodeSchema = z.object({
  id: z.uuid(),
  title: objectiveTitleSchema,
  summary: objectiveSummarySchema,
});

export const objectiveGraphNodeSchema = z.union([
  objectiveGraphGuideNodeSchema,
  objectiveGraphRequestNodeSchema,
]);

export const objectiveGraphEdgeSchema = z.object({
  from_node_id: z.uuid(),
  to_node_id: z.uuid(),
});

export const objectiveGraphSchema = z.object({
  nodes: z.array(objectiveGraphNodeSchema),
  edges: z.array(objectiveGraphEdgeSchema),
});

// Overwrite a draft revision's metadata. Partial: send only the fields you want
// to change (at least one). `targets` is declarative and replaces the whole
// curation: a target's position and the featured flag are unique per revision,
// so they cannot be moved one row at a time without tripping a constraint.
export const updateObjectiveRevisionSchema = z
  .object({
    title: objectiveTitleSchema,
    summary: objectiveSummarySchema.nullish(),
    change_summary: objectiveChangeSummarySchema.nullish(),
    tags: z.array(z.uuid()),
    targets: z.array(objectiveTargetSchema),
    graph: objectiveGraphSchema,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: "at least one field is required",
  });

// Edit one node of a draft revision: swap the pinned variant (guide_id),
// skip/re-include it (is_included), or set a note. Whether it is a target is
// derived from the graph. Partial; at least one field.
export const updateObjectiveNodeSchema = z
  .object({
    guide_id: z.uuid(),
    is_included: z.boolean(),
    note: z.string().trim().nullish(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: "at least one field is required",
  });

export type CreateObjectiveInput = z.infer<typeof createObjectiveSchema>;
export type ObjectiveTargetInput = z.infer<typeof objectiveTargetSchema>;
export type ObjectiveGraphInput = z.infer<typeof objectiveGraphSchema>;
export type UpdateObjectiveRevisionInput = z.infer<
  typeof updateObjectiveRevisionSchema
>;
export type UpdateObjectiveNodeInput = z.infer<
  typeof updateObjectiveNodeSchema
>;
