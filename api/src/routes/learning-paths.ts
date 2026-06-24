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
  // Gets the full snapshot of one revision: metadata, nodes, and projected edges.
  .get('/:id', (c) => c.json({ error: 'Not implemented' }, 501))

  // Overwrite a draft revision's metadata (draft only)
  .patch('/:id', requireUser, (c) => c.json({ error: 'Not implemented' }, 501))

  // Edit a node: swap the chosen variant, set a note, toggle is_target, or
  // skip/re-include it. Skipping is a soft hide, not a delete.
  .patch('/:id/nodes/:baseId', requireUser, (c) => c.json({ error: 'Not implemented' }, 501))

  // Publish the draft directly: freeze its edges and point the path at it
  .post('/:id/publish', requireUser, (c) => c.json({ error: 'Not implemented' }, 501))

  // Roll back: clone an older revision's targets/nodes into a new draft
  .post('/:id/rollback', requireUser, (c) => c.json({ error: 'Not implemented' }, 501))

  // Rendered diff between two revision snapshots
  .get('/:id/diff/:otherId', (c) => c.json({ error: 'Not implemented' }, 501))
