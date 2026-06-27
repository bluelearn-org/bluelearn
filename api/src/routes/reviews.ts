import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { requireUser } from '../middleware/auth.middleware'
import type { HonoEnv } from '../types'
import {
  castDecision,
  getReviewCase,
  getReviewQueue,
  listMyReviewCases,
} from '../services/review.service'

const createDecisionSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  notes: z.string().trim().nullish(),
})

export const reviewsRouter = new Hono<HonoEnv>()
  // Open cases needing action from the current reviewer
  .get('/queue', requireUser, async (c) => {
    const cases = await getReviewQueue(c.get('supabase'), c.get('user').id)
    return c.json({ cases }, 200)
  })

  // Past / finished review cases the caller was a panelist on
  .get('/cases', requireUser, async (c) => {
    const cases = await listMyReviewCases(c.get('supabase'), c.get('user').id)
    return c.json({ cases }, 200)
  })

  // Case detail with panel, members, decisions, and linked revision
  .get('/cases/:id', async (c) => {
    const reviewCase = await getReviewCase(c.get('supabase'), c.req.param('id'))
    return c.json({ case: reviewCase }, 200)
  })

  // Cast a panel vote with written justification
  .post(
    '/cases/:id/decisions',
    requireUser,
    zValidator('json', createDecisionSchema),
    async (c) => {
      const { decision, notes } = c.req.valid('json')
      const result = await castDecision(
        c.get('supabase'),
        c.get('user').id,
        c.req.param('id'),
        { decision, notes },
      )
      return c.json({ decision: result }, 201)
    },
  )
