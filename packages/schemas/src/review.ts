import { z } from "zod";

// Cast or update a panel vote on a review case. decision is required;
// notes is an optional written justification.
export const createDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  notes: z.string().trim().nullish(),
});

export type CreateDecisionInput = z.infer<typeof createDecisionSchema>;
