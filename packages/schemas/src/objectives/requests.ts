import { z } from "zod";
import {
  objectiveChangeSummarySchema,
  objectiveSummarySchema,
  objectiveTitleSchema,
} from "./fields";

// Title may be empty until publish. Targets come later, from the graph.
export const createObjectiveSchema = z.object({
  title: objectiveTitleSchema.nullish(),
  summary: objectiveSummarySchema.nullish(),
  tags: z.array(z.uuid()).default([]),
});

// Position is the array index. The server derives which nodes are targets.
// `sequence` lists the node ids under this target in reading order. Omit it
// on every target to leave the sequences unchanged.
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

// Targets are derived from the graph, so this cannot set one.
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
