import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'
import { ServiceError } from '../lib/service-error'
import { slugify } from '../lib/slug'

type DB = SupabaseClient<Database>

export async function listSubjects(supabase: DB) {
  const { data, error } = await supabase
    .from('subjects')
    .select('id, slug, name')

  if (error) throw new ServiceError(error.message, 500)
  return data ?? []
}

export async function createSubject(supabase: DB, userId: string, name: string) {
  const slug = slugify(name)
  if (!slug) throw new ServiceError('Title must contain at least one letter or number', 400)

  const { data, error } = await supabase
    .from('subjects')
    .insert({ slug, name, creator_id: userId })
    .select('id, slug, name')
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new ServiceError('Error: This subject name is a duplicate of an existing subject.', 409)
    }
    throw new ServiceError(error.message, 500)
  }

  return data
}

export async function getSubjectBySlug(supabase: DB, rawSlug: string) {
  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .eq('slug', rawSlug)
    .maybeSingle()

  if (error) throw new ServiceError(error.message, 500)
  if (!data) throw new ServiceError('Subject not found.', 404)

  return data
}

export async function listSubjectGuides(supabase: DB, rawSlug: string) {
  const { data: subject, error } = await supabase
    .from('subjects')
    .select('id')
    .eq('slug', rawSlug)
    .maybeSingle()

  if (error) throw new ServiceError(error.message, 500)
  if (!subject) throw new ServiceError('Subject not found', 404)

  const { data: guideSubjects, error: guideError } = await supabase
    .from('guide_subjects')
    .select('guide_base_id')
    .eq('subject_id', subject.id)

  if (guideError) throw new ServiceError(guideError.message, 500)

  const ids = guideSubjects.map((r) => r.guide_base_id)
  if (ids.length === 0) return []

  const { data: guideBases, error: baseError } = await supabase
    .from('guide_bases')
    .select('slug, title, knowledge_type')
    .in('id', ids)
    .order('title')

  if (baseError) throw new ServiceError(baseError.message, 500)

  return guideBases ?? []
}
