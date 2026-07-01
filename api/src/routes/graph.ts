import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  createPrerequisiteSchema,
  createTodoPrerequisiteSchema,
} from '@bluelearn/schemas'
import { requireUser } from '../middleware/auth.middleware'
import type { HonoEnv } from "../types"
import { ServiceError } from '../lib/service-error'

// Separate routers
export const prerequisitesRouter = new Hono()
export const todosRouter = new Hono()

//POST /prerequisites
prerequisitesRouter.post(
  '/',
  requireUser,
  zValidator('json', createPrerequisiteSchema),
  async (c) => {
    const supabase = c.get('supabase')
    const { from_guide_base_id, to_guide_base_id } = c.req.valid('json')

    const { data, error } = await supabase
      .from('guide_edges')
      .insert({
        from_guide_base_id,
        to_guide_base_id,
        edge_type: 'prerequisite',
      })
      .select('id, from_guide_base_id, to_guide_base_id, edge_type')
      .single()

    if (error) {
      switch (error.code) {
        // duplicates
        case '23505':
          throw new ServiceError('Prerequisite already exists', 409)
        // self loop
        case '23514':
          throw new ServiceError('Self-loop is not allowed', 422)
        // cycle
        case 'P0001':
          throw new ServiceError('This would create a cycle', 409)
        // others
        default:
          throw new ServiceError('Failed to create prerequisite', 500)
      }
    }

    return c.json({ edge: data }, 201)
  }
)

// DELETE /prerequisites/:id
prerequisitesRouter.delete('/:id', requireUser, async (c) => {
  const supabase = c.get('supabase')
  const id = c.req.param('id')

  const { data, error } = await supabase
    .from('guide_edges')
    .update({ is_suspended: true })
    .eq('id', id)
    .select('id, is_suspended')
    .single()

  if (error) {
    throw new ServiceError('Failed to suspend prerequisite', 500)
  }

  return c.json({ edge: data }, 200)
})

// GET /todos
todosRouter.get('/', async (c) => {
  const supabase = c.get('supabase')

  const { data, error } = await supabase
    .from('todo_prerequisites')
    .select('id, dependent_guide_base_id, title, status')
    .eq('status', 'open')

  if (error) {
    throw new ServiceError('Failed to fetch todos', 500)
  }

  return c.json({ todos: data }, 200)
})

// POST /todos
todosRouter.post(
  '/',
  requireUser,
  zValidator('json', createTodoPrerequisiteSchema),
  async (c) => {
    const supabase = c.get('supabase')
    const { dependent_guide_base_id, title } = c.req.valid('json')

    const { data, error } = await supabase
      .from('todo_prerequisites')
      .insert({
        dependent_guide_base_id,
        title,
        status: 'open',
      })
      .select('id, dependent_guide_base_id, title, status')
      .single()

    if (error) {
      throw new ServiceError('Failed to create todo', 500)
    }

    return c.json({ todo: data }, 201)
  }
)
