import { SupabaseClient } from '@supabase/supabase-js'
import { ServiceError } from '../lib/service-error'
import type { Database } from '../database.types'

import { type FileUpload, type UUID } from '@bluelearn/schemas'

type DB = SupabaseClient<Database>

export function fileNameCleaner(name: string) {
  // Clean file names before upload
  name = name.replaceAll(' ', '-')                 // Replace spaces with en dashes
  name = name.replaceAll(/[^a-zA-Z0-9_\-\.]/g, '') // Remove special characters
  return name
}

export async function uploadMediaFile(file: FileUpload, userId: string, db: DB) {
  // Uploads media file to bucket and store path in database
  const cleanFileName = fileNameCleaner(file.name)

  // Upload to storage
  const { data: uploadData, error: uploadError } = await db.storage
    .from('media')
    .upload(`uploads/${Date.now()}_${cleanFileName}`, file)

  if (uploadError) {
    console.error(uploadError)
    throw new ServiceError('File upload failed', 500)
  }

  // Insert path of uploadData into database
  const { data: databaseEntry, error: databaseError } = await db
    .from('media_assets')
    .insert({
      storage_key: uploadData.path,
      uploaded_by: userId,
    })
    .select()
    .single()

  if (databaseError) {
    console.error('media_assets insert failed:', databaseError.message)
    throw new ServiceError('Failed to store file metadata in database', 500)
  }

  return databaseEntry
}