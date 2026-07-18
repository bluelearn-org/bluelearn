import { z } from "zod";
import { subjectReferenceSchema } from "../subjects";
import { guideStatusSchema, knowledgeTypeSchema } from "./enums";
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

// A guide as listed anywhere it renders as a card (GET /guides, subject
// pages). duration_minutes derives from the stored body word count.
export const guideListItemSchema = z.object({
  id: z.uuid(),
  slug: z.string().nullable(),
  title: z.string().nullable(),
  knowledge_type: knowledgeTypeSchema,
  summary: z.string().nullable(),
  status: guideStatusSchema,
  created_at: z.iso.datetime(),
  author: z.string().nullable(),
  duration_minutes: z.number().int(),
  tags: z.array(subjectReferenceSchema),
});

export type Guide = z.infer<typeof guideSchema>;
export type GuideListItem = z.infer<typeof guideListItemSchema>;
export type Walkthrough = z.infer<typeof walkthroughSchema>;
