import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'

type Bindings = {
  SUPABASE: any
}

export const graph = new Hono<{ Bindings: Bindings }>()

/**
 * POST /prerequisites
 */
graph.post(
  '/prerequisites',
  zValidator(
    'json',
    z.object({
      from_guide_base_id: z.string().uuid(),
      to_guide_base_id: z.string().uuid(),
    })
  ),
  async (c) => {
    const supabase = c.env.SUPABASE
    const { from_guide_base_id, to_guide_base_id } = c.req.valid('json')

    const { data, error } = await supabase
      .from('guide_edges')
      .insert({
        from_guide_base_id,
        to_guide_base_id,
        edge_type: 'prerequisite',
      })
      .select()
      .single()

    if (error) {
      switch (error.code) {
        case '23505':
          return c.json({ error: 'Prerequisite already exists' }, 409)
        case '23514':
          return c.json({ error: 'Self-loop is not allowed' }, 422)
        case 'P0001':
          return c.json({ error: 'This would create a cycle' }, 409)
        default:
          return c.json({ error: 'Failed to create prerequisite' }, 500)
      }
    }

    return c.json(data, 201)
  }
)

/**
 * DELETE /prerequisites (suspend)
 */
graph.delete(
  '/prerequisites',
  zValidator(
    'json',
    z.object({
      guide_edge_id: z.string().uuid(),
    })
  ),
  async (c) => {
    const supabase = c.env.SUPABASE
    const { guide_edge_id } = c.req.valid('json')

    const { data, error } = await supabase
      .from('guide_edges')
      .update({ is_suspended: true })
      .eq('id', guide_edge_id)
      .select()
      .single()

    if (error) {
      return c.json({ error: 'Failed to suspend prerequisite' }, 500)
    }

    return c.json(data, 200)
  }
)

/**
 * GET /todos
 */
graph.get('/todos', async (c) => {
  const supabase = c.env.SUPABASE

  const { data, error } = await supabase
    .from('todo_prerequisites')
    .select('*')
    .eq('status', 'open')

  if (error) {
    return c.json({ error: 'Failed to fetch todos' }, 500)
  }

  return c.json(data, 200)
})

/**
 * POST /todos (FIXED)
 */
graph.post(
  '/todos',
  zValidator(
    'json',
    z.object({
      from_guide_base_id: z.string().uuid(),
      to_guide_base_id: z.string().uuid().optional(),
      title: z.string().min(1),
    })
  ),
  async (c) => {
    const supabase = c.env.SUPABASE
    const { from_guide_base_id, to_guide_base_id, title } =
      c.req.valid('json')

    const { data, error } = await supabase
      .from('todo_prerequisites')
      .insert({
        dependent_guide_base_id: from_guide_base_id,
        resolved_guide_base_id: to_guide_base_id ?? null,
        title,
        status: 'open',
      })
      .select()
      .single()

    if (error) {
      return c.json({ error: 'Failed to create todo' }, 500)
    }

    return c.json(data, 201)
  }
)
