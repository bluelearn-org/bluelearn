import { z } from "zod";
import { edgeTypeSchema, todoStatusSchema } from "./enums";

export const todoListItemSchema = z.object({
  id: z.uuid(),
  guide_base_id: z.uuid(),
  guide_slug: z.string().nullable(),
  guide_title: z.string().nullable(),
  title: z.string(),
  summary: z.string(),
  status: todoStatusSchema,
  claim_count: z.number().int(),
  created_at: z.iso.datetime({ offset: true }),
});

export const todoSchema = z.object({
  id: z.uuid(),
  guide_base_id: z.uuid(),
  title: z.string(),
  summary: z.string(),
  status: todoStatusSchema,
  created_at: z.iso.datetime({ offset: true }),
});

export const guideEdgeSchema = z.object({
  id: z.uuid(),
  from_guide_base_id: z.uuid(),
  to_guide_base_id: z.uuid(),
  edge_type: edgeTypeSchema,
  is_suspended: z.boolean(),
  created_at: z.iso.datetime({ offset: true }),
});

export const prerequisiteResponseSchema = z.strictObject({
  edge: guideEdgeSchema,
});

export const todoListResponseSchema = z.strictObject({
  todos: z.array(todoListItemSchema),
});

export const todoResponseSchema = z.strictObject({
  todo: todoSchema,
});

export type TodoStatus = z.infer<typeof todoStatusSchema>;
export type EdgeType = z.infer<typeof edgeTypeSchema>;
export type TodoListItem = z.infer<typeof todoListItemSchema>;
export type Todo = z.infer<typeof todoSchema>;
export type GuideEdge = z.infer<typeof guideEdgeSchema>;
