import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../database.types"
import { ServiceError } from "../lib/service-error"
import { slugify } from "../lib/slug"
import { CANONICAL_SUMMARY } from "./guide.service"

type DB = SupabaseClient<Database>

export async function listSubjects(supabase: DB) {
  const { data, error } = await supabase
    .from("subjects")
    .select("id, slug, name")

  if (error) {
    console.error(error)
    throw new ServiceError("Failed to load subjects", 500)
  }
  return data ?? []
}

export async function createSubject(supabase: DB, userId: string, name: string) {
  const slug = slugify(name)
  if (!slug) throw new ServiceError("Title must contain at least one letter or number", 400)

  const { data, error } = await supabase
    .from("subjects")
    .insert({ slug, name, creator_id: userId })
    .select("id, slug, name")
    .single()

  if (error) {
    if (error.code === "23505") {
      throw new ServiceError("Subject already exists", 409)
    }
    console.error(error)
    throw new ServiceError("Failed to create subject", 500)
  }

  return data
}

export async function getSubjectBySlug(supabase: DB, rawSlug: string) {
  const { data, error } = await supabase
    .from("subjects")
    .select("id, slug, name")
    .eq("slug", rawSlug)
    .maybeSingle()

  if (error) {
    console.error(error)
    throw new ServiceError("Failed to load subject", 500)
  }
  if (!data) throw new ServiceError("Subject not found.", 404)

  return data
}

export async function listSubjectGuides(supabase: DB, rawSlug: string) {
  const { data: subject, error } = await supabase
    .from("subjects")
    .select("id")
    .eq("slug", rawSlug)
    .maybeSingle()

  if (error) {
    console.error(error)
    throw new ServiceError("Failed to load subject", 500)
  }
  if (!subject) throw new ServiceError("Subject not found", 404)

  const { data, error: guideError } = await supabase
    .from("guide_bases")
    .select(`id, slug, title, guide_subjects!inner(subject_id), ${CANONICAL_SUMMARY}`)
    .eq("guide_subjects.subject_id", subject.id)
    .order("title")

  if (guideError) {
    console.error(guideError)
    throw new ServiceError("Failed to load subject guides", 500)
  }

  return (data ?? []).map(({ canonical, guide_subjects: _tags, ...base }) => ({
    ...base,
    summary: canonical?.current?.summary ?? null,
  }))
}
