import { Hono } from 'hono'
import { requireUser } from '../middleware/auth.middleware'
import type { HonoEnv } from '../types'

import { uploadMediaFile } from '../services/media.service'

export const mediaRouter = new Hono<HonoEnv>()
  // Upload a file to object storage and store entry in database
  .post('/upload', requireUser, async (c) => {
    const userId = c.get('user').id
    const body = await c.req.formData()
    const file = body.get('file') as File | null

    if (!file) 
      return c.json({ error: 'Missing required field: file' }, 400)
    if (!(file instanceof File))
      return c.json({ error: 'Field "file" must be a file upload, got ' + typeof file }, 400)

    const supabase = c.get('supabase')
    const entry = await uploadMediaFile(file, userId, supabase)

    return c.json(entry, 201)
  })
