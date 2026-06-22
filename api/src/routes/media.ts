import { Hono } from 'hono'
import { requireUser } from '../middleware/auth.middleware'
import type { HonoEnv } from '../types'

export const mediaRouter = new Hono<HonoEnv>()
  // Upload a file to object storage
  .post('/upload', requireUser, async (c) => {
    const supabase = c.get('supabase')

    const body = await c.req.formData()
    const file = body.get('file') as File | null

    if (!file || !(file instanceof File))
      return c.json({ error: 'No file uploaded' }, 400)

    // Upload to storage
    const { data: storageData, error: storageError } = await supabase.storage
      .from('media_assets')
      .upload(`uploads/${Date.now()}_${file.name}`, file)

    if (storageError)
      return c.json({ error: storageError.message }, 500)

    // Insert path of storageData into database
    const { data, error: databaseError } = await supabase
      .from('media_assets')
      .insert({
        storage_key: storageData.path,
        uploaded_by: c.get('user').id,
        created_at: new Date().toUTCString(),
        id: storageData.id
      })
      .select()
      .single()

    if (databaseError)
      return c.json({ error: databaseError.message }, 500)

    return c.json({ data }, 201)
  })
