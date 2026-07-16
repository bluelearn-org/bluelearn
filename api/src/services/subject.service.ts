import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  GuideListItem,
  ObjectiveListItem,
  SubjectListItem,
} from "@bluelearn/schemas";
import type { Database } from "../database.types";
import { ServiceError } from "../lib/service-error";
import { slugify } from "../lib/slug";
import { buildGuideListItems } from "./guide.service";
import { buildObjectiveListItems } from "./objective.service";

type DB = SupabaseClient<Database>;

// Resolve a subject slug to its id, or 404. Shared by the tagged-node listings.
async function resolveSubjectId(supabase: DB, rawSlug: string) {
  const { data, error } = await supabase
    .from("subjects")
    .select("id")
    .eq("slug", rawSlug)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load subject", 500);
  }
  if (!data) throw new ServiceError("Subject not found", 404);
  return data;
}

// Tally rows carrying nested subject tags into a subject_id -> count map. Each
// row is one guide or objective, so counting tags counts the nodes per subject.
function tallyBySubject(tagsPerRow: Array<Array<{ subject_id: string }>>) {
  const counts = new Map<string, number>();

  for (const tags of tagsPerRow) {
    for (const { subject_id } of tags) {
      counts.set(subject_id, (counts.get(subject_id) ?? 0) + 1);
    }
  }

  return counts;
}

export async function listSubjects(supabase: DB): Promise<SubjectListItem[]> {
  const { data, error } = await supabase
    .from("subjects")
    .select("id, slug, name, summary");

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load subjects", 500);
  }

  // Counts mirror the filters listSubjectGuides/listSubjectObjectives apply, so
  // a total here matches the length of the list those endpoints return.
  const [guideCounts, objectiveCounts] = await Promise.all([
    countGuidesBySubject(supabase),
    countObjectivesBySubject(supabase),
  ]);

  return (data ?? []).map((subject) => ({
    ...subject,
    guides_total: guideCounts.get(subject.id) ?? 0,
    objectives_total: objectiveCounts.get(subject.id) ?? 0,
  }));
}

async function countGuidesBySubject(supabase: DB) {
  const { data, error } = await supabase.from("guide_bases").select(
    `id,
       canonical:guides!guide_bases_canonical_guide_id_fkey!inner(
         current:guide_revisions!guides_current_revision_id_fkey!inner(
           guide_revision_subjects!inner(subject_id)
         )
       )`
  );

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load subjects", 500);
  }

  return tallyBySubject(
    (data ?? []).map((base) => base.canonical.current.guide_revision_subjects)
  );
}

async function countObjectivesBySubject(supabase: DB) {
  const { data, error } = await supabase
    .from("objectives")
    .select(
      `id,
       current:objective_revisions!objectives_current_revision_id_fkey!inner(
         objective_revision_subjects!inner(subject_id)
       )`
    )
    .eq("status", "published");

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load subjects", 500);
  }

  return tallyBySubject(
    (data ?? []).map(
      (objective) => objective.current.objective_revision_subjects
    )
  );
}

export async function createSubject(
  supabase: DB,
  userId: string,
  name: string
) {
  const slug = slugify(name);
  if (!slug)
    throw new ServiceError(
      "Title must contain at least one letter or number",
      400
    );

  const { data, error } = await supabase
    .from("subjects")
    .insert({ slug, name, creator_id: userId })
    .select("id, slug, name")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ServiceError("Subject already exists", 409);
    }
    console.error(error);
    throw new ServiceError("Failed to create subject", 500);
  }

  return data;
}

export async function getSubjectBySlug(supabase: DB, rawSlug: string) {
  const { data, error } = await supabase
    .from("subjects")
    .select("id, slug, name")
    .eq("slug", rawSlug)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load subject", 500);
  }
  if (!data) throw new ServiceError("Subject not found.", 404);

  return data;
}

export async function listSubjectGuides(
  supabase: DB,
  rawSlug: string
): Promise<GuideListItem[]> {
  const subject = await resolveSubjectId(supabase, rawSlug);

  const { data, error: guideError } = await supabase
    .from("guide_bases")
    .select(
      `id, slug, title, knowledge_type, status, created_at,
       canonical:guides!guide_bases_canonical_guide_id_fkey!inner(
         author_id,
         current:guide_revisions!guides_current_revision_id_fkey!inner(
           id, summary, word_count,
           guide_revision_subjects!inner(subject_id)
         )
       )`
    )
    .eq("canonical.current.guide_revision_subjects.subject_id", subject.id)
    .order("title");

  if (guideError) {
    console.error(guideError);
    throw new ServiceError("Failed to load subject guides", 500);
  }

  return buildGuideListItems(supabase, data ?? []);
}

export async function listSubjectObjectives(
  supabase: DB,
  rawSlug: string
): Promise<ObjectiveListItem[]> {
  const subject = await resolveSubjectId(supabase, rawSlug);

  const { data, error: objError } = await supabase
    .from("objectives")
    .select(
      `id, slug, created_by, created_at, current_revision_id,
       current:objective_revisions!objectives_current_revision_id_fkey!inner(
         title, summary,
         objective_revision_subjects!inner(subject_id)
       )`
    )
    .eq("current.objective_revision_subjects.subject_id", subject.id)
    .eq("status", "published");

  if (objError) {
    console.error(objError);
    throw new ServiceError("Failed to load subject objectives", 500);
  }

  // Title lives on the revision and the node -> revision FK is composite
  // (to-many), so PostgREST can't sort the objectives by it. Sort here instead.
  const items = await buildObjectiveListItems(supabase, data ?? []);
  return items.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
}
