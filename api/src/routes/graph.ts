import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { requireUser } from '../middleware/auth.middleware'
import {
  createPrerequisiteSchema,
  createTodoPrerequisiteSchema,
} from '@bluelearn/schemas'
import type { HonoEnv } from '../types'

// PREREQUISITES ROUTER
export const prerequisitesRouter = new Hono<HonoEnv>()

  // POST /prerequisites -> create a prerequisite edge
  .post(
    '/',
    requireUser,
    zValidator('json', createPrerequisiteSchema),
    async (c) => {
      const { from_guide_base_id, to_guide_base_id } =
        c.req.valid('json')

      const supabase = c.get('supabase')

      const { data, error } = await supabase
        .from('guide_edges')
        .insert({
          from_guide_base_id,
          to_guide_base_id,
          edge_type: 'prerequisite',
          is_suspended: false,
        })
        .select()
        .single()

      if (error) {
        switch (error.code) {
          case '23505': // duplicate
            return c.json(
              { error: 'Prerequisite already exists' },
              409
            )
          case '23514': // self-loop
            return c.json(
              { error: 'A guide cannot depend on itself' },
              422
            )
          case 'P0001': // cycle
            return c.json(
              { error: 'This would create a cycle' },
              409
            )
          default:
            console.error(error)
            return c.json(
              { error: 'Failed to create prerequisite' },
              500
            )
        }
      }

      return c.json({ data }, 201)
    }
  )

  // DELETE /prerequisites/:id → suspend for verifiers
  .delete('/:id', requireUser, async (c) => {
    const id = c.req.param('id')
    const supabase = c.get('supabase')

    const { data, error } = await supabase
      .from('guide_edges')
      .update({ is_suspended: true })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error(error)
      return c.json(
        { error: 'Failed to remove prerequisite' },
        500
      )
    }

    if (!data) {
      return c.json({ error: 'Guide edge not found' }, 404)
    }

    return c.json({ data }, 200)
  })

// TODOS ROUTER
export const todosRouter = new Hono<HonoEnv>()

  // GET /todos -> fetch all open TODO prerequisites
  .get('/', async (c) => {
    const supabase = c.get('supabase')

    const { data, error } = await supabase
      .from('todo_prerequisites')
      .select('*')
      .eq('status', 'open')

    if (error) {
      console.error(error)
      return c.json({ error: 'Failed to fetch todos' }, 500)
    }

    return c.json({ data }, 200)
  })

  // POST /todos -> declare a missing prerequisite topic
  .post(
    '/',
    requireUser,
    zValidator('json', createTodoPrerequisiteSchema),
    async (c) => {
      const { from_guide_base_id, missing_topic } =
        c.req.valid('json')

      const supabase = c.get('supabase')

      const { data, error } = await supabase
        .from('todo_prerequisites')
        .insert({
          from_guide_base_id,
          missing_topic,
          status: 'open',
        })
        .select()
        .single()

      if (error) {
        switch (error.code) {
          case '23505': // duplicate todo
            return c.json(
              { error: 'Todo prerequisite already exists' },
              409
            )
          default:
            console.error(error)
            return c.json(
              { error: 'Failed to create todo prerequisite' },
              500
            )
        }
      }

      return c.json({ data }, 201)
    }
  )

// Discord handle: cyberrift1
