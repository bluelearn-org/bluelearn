import { z } from 'zod'

export const decisionReasons = [
  'hierarchy_issue',
  'factual_error',
  'duplicate_content',
  'scope_violation',
  'clarity_issue',
  'missing_required_information',
] as const

// Cast a panel vote. An approve carries only a justification; a reject must
// also cite at least one rubric reason, matching the OpenAPI oneOf spec.
export const createDecisionSchema = z.discriminatedUnion('decision', [
  z.object({
    decision: z.literal('approved'),
    justification: z.string().trim().min(1),
  }),
  z.object({
    decision: z.literal('rejected'),
    justification: z.string().trim().min(1),
    reasons: z.array(z.enum(decisionReasons)).min(1),
  }),
])

export type CreateDecisionInput = z.infer<typeof createDecisionSchema>
