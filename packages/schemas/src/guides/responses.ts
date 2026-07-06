import { z } from "zod";
import { subjectReferenceSchema } from "../subjects";
import { guideReferenceSchema } from "./references";

export const guideSchema = z.object({
  slug: z.string(),
  title: z.string(),
  author: z.string(),
  summary: z.string().nullable(),
  body: z.string().nullable(),
  word_count: z.number().int(),
  created_at: z.iso.datetime(),
  tags: z.array(subjectReferenceSchema),
  prerequisites: z.array(guideReferenceSchema),
});

// depth is the longest-chain distance from the target (depth 0).
export const walkthroughSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.uuid(),
      slug: z.string(),
      title: z.string(),
      summary: z.string().nullable(),
      depth: z.number().int(),
    })
  ),
  edges: z.array(
    z.object({
      from_id: z.uuid(),
      to_id: z.uuid(),
    })
  ),
});

export type Guide = z.infer<typeof guideSchema>;
export type Walkthrough = z.infer<typeof walkthroughSchema>;
