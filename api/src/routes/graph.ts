import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { requireUser } from '../middleware/auth.middleware'
import { createPrerequisiteSchema } from '@bluelearn/schemas'
import type { HonoEnv } from '../types'

export const prerequisitesRouter = new Hono<HonoEnv>()

  // POST /prerequisites -> create a guide_edge
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

          // unique_violation -> duplicate
          case '23505':
            return c.json(
              { error: 'Prerequisite already exists' },
              409
            )
          
          // check_violation -> self-loop
          case '23514':
            return c.json(
              { error: 'A guide cannot depend on itself' },
              422
            )
          
          // cycle detection trigger
          case 'P0001':
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

  // DELETE /prerequisites/:id -> suspend for the verifiers
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
        { error: 'Failed to suspend prerequisite' },
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

  // GET /todos → fetch open todo prerequisites
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


//Discord handle: cyberrift1
