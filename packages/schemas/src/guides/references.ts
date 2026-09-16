import { z } from "zod";

// A lightweight guide pointer (e.g. a node in an objective or walkthrough). Slug/title
// are server-produced here, so they stay unconstrained.
export const guideReferenceSchema = z.object({
  slug: z.string(),
  title: z.string(),
});

export type GuideReference = z.infer<typeof guideReferenceSchema>;

// Requested prerequisites don't have a guide slug to link to yet.
export const todoPrerequisiteReferenceSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  summary: z.string(),
});

export type TodoPrerequisiteReference = z.infer<
  typeof todoPrerequisiteReferenceSchema
>;
