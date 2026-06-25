import { Hono } from 'hono'
import { requireUser } from '../middleware/auth.middleware'
import type { HonoEnv } from '../types'

import { uploadMediaFile } from '../services/mediaService'

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

  // Delete a file in object storage
  .delete('/:id', requireUser, async (c) => {
    const id = c.req.param('id')
    const userId = c.get('user').id

    // Search database for storage key by id. Verify ownership
    const supabase = c.get('supabase')

    const { data: asset, error: fetchError } = await supabase
      .from('media_assets')
      .select('storage_key, uploaded_by')
      .eq('id', id)
      .single()

    if (!asset)
      return c.json({ error: 'Asset not found' }, 404)

    if (asset.uploaded_by !== userId)
      return c.json({ error: 'Unauthorized to delete this media asset' }, 403)

    if (fetchError) {
      if (fetchError.code === 'PGRST116')
        return c.json({ error: 'Asset not found' }, 404)

      console.error('media_assets fetch failed:', fetchError)
      return c.json({ error: 'Internal server error' }, 500)
    }

    // Delete from database
    const { error: databaseError } = await supabase
      .from('media_assets')
      .delete()
      .eq('id', id)

    if (databaseError) {
      console.error('media_assets delete failed:', databaseError)
      return c.json({ error: 'Internal server error' }, 500)
    }

    return c.json({ message: 'Asset deleted successfully' }, 200)
  })

  // Download file from database and display in browser
  .get('/:id/display', async (c) => {
    const id = c.req.param('id')
    const supabase = c.get('supabase')

    const { data: storageData, error } = await supabase
      .from('media_assets')
      .select('storage_key')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116')
        return c.json({ error: 'Media not found' }, 404)

      console.error('media download failed:', error)
      return c.json({ error: 'Internal server error' }, 500)
    }

    let storagePath = storageData.storage_key
    storagePath = storagePath.split('/').map(encodeURIComponent).join('/')

    const { data: downloadData, error: downloadError } = await supabase.storage
      .from('media_assets')
      .download(storagePath)

    if (downloadError)
      return c.json({ error: downloadError.message }, 500)

    const buffer = await downloadData.arrayBuffer()

    return new Response(buffer, {
      headers: {
        'Content-Type': downloadData.type,
      }
    })
  })

  // Get file info from database
  .get('/:id/info', async (c) => {
    const id = c.req.param('id')

    const supabase = c.get('supabase')

    const { data, error: fetchError } = await supabase
      .from('media_assets')
      .select('uploaded_by, created_at')
      .eq('id', id)
      .single()

    if (!data)
      return c.json({ error: 'Asset not found' }, 404)

    if (fetchError) {
      if (fetchError.code === 'PGRST116')
        return c.json({ error: 'Asset not found' }, 404)
    
      console.error('media_assets fetch failed:', fetchError)
      return c.json({ error: 'Internal server error' }, 500)
    }

    return c.json({ data }, 200)
  })

  // Update a file in object storage. Keep old file in database as part of revision history
  .patch('/:id', requireUser, async (c) => {
    const id     = c.req.param('id')
    const userId = c.get('user').id
    const body = await c.req.formData()
    const file = body.get('file') as File | null

    if (!file) 
      return c.json({ error: 'Missing required field: file' }, 400)
    if (!(file instanceof File))
      return c.json({ error: 'Field "file" must be a file upload, got ' + typeof file }, 400)
    
    // Upload to database
    const supabase = c.get('supabase')
    const entry = await uploadMediaFile(file, userId, supabase)

    // Add asset_id
    const { error: revisionError } = await supabase
      .from('media_assets_revision')
      .insert({
        asset_id: id
      })

    if (revisionError)  {
      // Delete revised file from database to save storage
      const { error: databaseError } = await supabase
        .from('media_assets')
        .delete()
        .eq('id', id)

      if (databaseError) {
        console.error('media_assets delete failed after revision upload fail:', databaseError)
        return c.json({ error: 'Internal server error' }, 500)
      }

      console.log('Successfully deleted revision after upload fail')
      console.log(`\tAsset ID: ${id}`)
      return c.json({ error: 'Unable to add revision to database' }, 500)
    }

    // Get revision_id to return to user
    const { data: revisionData, error: fetchError } = await supabase
      .from('media_assets_revision')
      .select('revision_id')
    
    if (fetchError) {
      // Failed to fetch guides_revision.id, which media_guides_revision.id references as a foreign key
      console.error('Failed to fetch media_assets_revision.revision_id for user')
      return c.json({ error: 'Failed to fetch revision_id' }, 500)
    }

    return c.json({ message: 'Succesfully added revision' }, 200)
  })
