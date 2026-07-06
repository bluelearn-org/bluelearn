import { z } from "zod";
import { subjectReferenceSchema } from "../subjects";
import { guideReferenceSchema } from "../guides/references";

export const pathNodeSchema = z.object({
  guide: guideReferenceSchema,
  level: z.number().int(),
  is_target: z.boolean(),
  is_included: z.boolean(),
  note: z.string().nullable(),
  word_count: z.number().int(),
});

// A prerequisite edge between two nodes.
export const pathEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
});

// A learning path's metadata, the leveled nodes, and the edges. word_count
// is the sum over included nodes the client turns into total reading time.
export const learningPathSchema = z.object({
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  curator: z.string(),
  created_at: z.iso.datetime(),
  word_count: z.number().int(),
  tags: z.array(subjectReferenceSchema),
  nodes: z.array(pathNodeSchema),
  edges: z.array(pathEdgeSchema),
});

export type PathNode = z.infer<typeof pathNodeSchema>;
export type PathEdge = z.infer<typeof pathEdgeSchema>;
export type LearningPath = z.infer<typeof learningPathSchema>;
