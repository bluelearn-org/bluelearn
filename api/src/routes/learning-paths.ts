import { Hono } from 'hono'
import { requireUser } from '../middleware/auth.middleware'
import type { HonoEnv } from '../types'

export const learningPathsRouter = new Hono<HonoEnv>()
  // List published learning paths
  .get('/', (c) => c.json({ error: 'Not implemented' }, 501))

  // Create a draft path: shell + revision 1, seeding the closure of the
  // target(s) given in the body as the initial node set
  .post('/', requireUser, (c) => c.json({ error: 'Not implemented' }, 501))

  // Open a path: resolve the live current_revision_id and return
  // its full snapshot
  .get('/:slug', (c) => c.json({ error: 'Not implemented' }, 501))

  // Archive the path
  .delete('/:slug', requireUser, (c) => c.json({ error: 'Not implemented' }, 501))

  // Revision history for this path
  .get('/:slug/revisions', (c) => c.json({ error: 'Not implemented' }, 501))

  // Start a new draft revision
  .post('/:slug/revisions', requireUser, (c) => c.json({ error: 'Not implemented' }, 501))

export const learningPathRevisionsRouter = new Hono<HonoEnv>()
  // Gets the full snapshot of one revision (current or old), including metadata,
  // included nodes, and the revision's frozen projected edges
  .get('/:id', (c) => c.json({ error: 'Not implemented' }, 501))

  // Overwrite a draft revision's metadata (pre-submit only)
  .patch('/:id', requireUser, (c) => c.json({ error: 'Not implemented' }, 501))

  // The revision's included nodes
  .get('/:id/nodes', (c) => c.json({ error: 'Not implemented' }, 501))

  // Re-include a skipped topic as a node
  .post('/:id/nodes', requireUser, (c) => c.json({ error: 'Not implemented' }, 501))

  // Swap the chosen variant, set a note, or toggle is_target on a node
  .patch('/:id/nodes/:baseId', requireUser, (c) => c.json({ error: 'Not implemented' }, 501))

  // Skip a topic: remove it from the included set
  .delete('/:id/nodes/:baseId', requireUser, (c) => c.json({ error: 'Not implemented' }, 501))

  // Submit for review: flips to submitted and opens a review_case
  .post('/:id/submit', requireUser, (c) => c.json({ error: 'Not implemented' }, 501))

  // Roll back: clone an older revision's targets/nodes into a new draft
  .post('/:id/rollback', requireUser, (c) => c.json({ error: 'Not implemented' }, 501))

  // Rendered diff between two revision snapshots
  .get('/:id/diff/:otherId', (c) => c.json({ error: 'Not implemented' }, 501))
