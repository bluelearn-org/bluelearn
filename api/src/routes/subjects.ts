import { Hono } from 'hono'
import { requireUser } from '../middleware/auth.middleware'
import type { HonoEnv } from '../types'

export const subjectsRouter = new Hono<HonoEnv>()
  // List all subjects
  .get('/', async (c) => {
    const supabase =  c.get('supabase')
    const {data, error} = await supabase
      .from('subjects')
      .select('name')

    if (error) {
      return c.json({error: error.message}, 500);
    }
    return c.json(data, 200)
  })

  // Create a subject
  .post('/', requireUser, async (c) => {
    const supabase = c.get('supabase')
    const user = c.get('user')

    const {id, slug, name} = await c.req.json()
    const creator_id = user.id
    const created_at = new Date().toISOString()

    // check if subject exists
    const {count, error} = await supabase
      .from('subjects')
      .select('*', {count: 'exact', head: true})
      .eq('id', id);

    if (error) {
      return c.json({error: error.message}, 500)
    } else if (count > 0) { // subject already exists
      return c.json({error: "Subject already exists"}, 409)
    }

    // insert row to subjects
    const {error: insertError} = await supabase
      .from('subjects')
      .insert({id: id, slug: slug, name: name, creator_id: creator_id, created_at: created_at})
    if (insertError) {
      return c.json({error: insertError.message}, 500)  
    }
    
    return c.json(200)
  })

  // Subject metadata only (the tagged list is a separate call)
  .get('/:slug', async (c) => {
    const supabase =  c.get('supabase')
    const slug = c.req.param('slug')
    const {data, error} = await supabase
      .from('subjects')
      .select('*')
      .eq('slug', slug)

    if (error) {
      return c.json({error: error.message}, 500);
    }
    return c.json(data, 200)
  })

  // Alphabetical list of topics carrying this subject tag
  .get('/:slug/guides', async (c) => {
    const supabase = c.get('supabase')
    const slug = c.req.param('slug')
    const {data, error} = await supabase
      .from('guide_subjects')
      .select('guide_id')
      .eq('subject_id', slug)
      .order('guide_id', {ascending: true})
    if (error) {
      return c.json({error: error.message}, 500);
    }
    return c.json(data, 200)
  })
