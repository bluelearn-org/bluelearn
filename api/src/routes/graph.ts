import { Hono } from 'hono'
import { requireUser } from '../middleware/auth.middleware'
import type { HonoEnv } from '../types'

export const prerequisitesRouter = new Hono<HonoEnv>()

  // POST /prerequisites, Creates a guide_edge
  .post('/', requireUser, async (c) => {
    try {
      const body = await c.req.json()
      const { from_guide_base_id, to_guide_base_id } = body

      if (!from_guide_base_id || !to_guide_base_id) {
        return c.json(
          { error: 'Missing from_guide_base_id or to_guide_base_id' },
          400
        )
      }

      // Insert into guide_edges table
      const newEdge = await c.env.DB
        .insertInto('guide_edges')
        .values({
          from_guide_base_id,
          to_guide_base_id,
          is_suspended: false,
          created_at: new Date().toISOString(),
        })
        .returningAll()
        .executeTakeFirst()

      return c.json({ data: newEdge }, 201)
    } catch (err) {
      console.error(err)
      return c.json({ error: 'Failed to create prerequisite' }, 500)
    }
  })

  // DELETE /prerequisites, suspends
  .delete('/:id', requireUser, async (c) => {
    try {
      const id = c.req.param('id')

      if (!id) {
        return c.json({ error: 'Missing id' }, 400)
      }

      // Soft delete → set is_suspended = true
      const updated = await c.env.DB
        .updateTable('guide_edges')
        .set({
          is_suspended: true,
          updated_at: new Date().toISOString(),
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst()

      if (!updated) {
        return c.json({ error: 'Guide edge not found' }, 404)
      }

      return c.json({ data: updated }, 200)
    } catch (err) {
      console.error(err)
      return c.json({ error: 'Failed to suspend prerequisite' }, 500)
    }
  })

// TODOS ROUTER
export const todosRouter = new Hono<HonoEnv>()

  // GET /todos, Return all open todo prerequisites
  .get('/', async (c) => {
    try {
      const todos = await c.env.DB
        .selectFrom('todo_prerequisites')
        .selectAll()
        .where('status', '=', 'open')
        .execute()

      return c.json({ data: todos }, 200)
    } catch (err) {
      console.error(err)
      return c.json({ error: 'Failed to fetch todos' }, 500)
    }
  })

// This is CyberRift first collaboration with others.
// Any objection or suggestion may be given to CyberRift through dm in discord. (Username: cyberrift1).
// Best wishes,
// CyberRift.
