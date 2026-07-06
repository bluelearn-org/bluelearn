import { z } from "zod";

// A lightweight guide pointer (e.g. a node in a path or walkthrough). Slug/title
// are server-produced here, so they stay unconstrained.
export const guideReferenceSchema = z.object({
  slug: z.string(),
  title: z.string(),
});

export type GuideReference = z.infer<typeof guideReferenceSchema>;
