import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  GuideListItem,
  ObjectiveListItem,
  Pagination,
  SubjectGroup,
  SubjectListItem,
} from "@bluelearn/schemas";
import type { Database } from "../database.types";
import { ServiceError } from "../lib/service-error";
import { slugify } from "../lib/slug";
import { buildGuideListItems, PUBLISHED_GUIDE_SELECT } from "./guide.service";
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

// Used to count the number of guides and objectives under a subject.
function tallyBySubject(tagsPerRow: Array<Array<{ subject_id: string }>>) {
  const counts = new Map<string, number>();

  for (const tags of tagsPerRow) {
    for (const { subject_id } of tags) {
      counts.set(subject_id, (counts.get(subject_id) ?? 0) + 1);
    }
  }

  return counts;
}

export async function listSubjects(
  supabase: DB,
  { page, limit }: Pagination = { page: 1, limit: 20 }
): Promise<{ data: SubjectListItem[]; total: number }> {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, count, error } = await supabase
    .from("subjects")
    .select("id, slug, name, summary", { count: "exact" })
    .eq("status", "published")
    .order("name")
    .range(from, to);

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

  return {
    data: (data ?? [])
      .filter((s): s is typeof s & { slug: string } => s.slug !== null)
      .map((subject) => ({
        ...subject,
        guides_total: guideCounts.get(subject.id) ?? 0,
        objectives_total: objectiveCounts.get(subject.id) ?? 0,
      })),
    total: count ?? 0,
  };
}

// Subjects that don't start with a letter share one group.
const NON_LETTER_GROUP = "#";

function groupChar(name: string) {
  const first = name.at(0)?.toUpperCase() ?? "";
  return /^[A-Z]$/.test(first) ? first : NON_LETTER_GROUP;
}

export async function listGroupedSubjects(
  supabase: DB
): Promise<SubjectGroup[]> {
  const { data, error } = await supabase
    .from("subjects")
    .select("id, slug, name, summary")
    .eq("status", "published")
    .order("name");

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load subjects", 500);
  }

  const [guideCounts, objectiveCounts] = await Promise.all([
    countGuidesBySubject(supabase),
    countObjectivesBySubject(supabase),
  ]);

  const groups = new Map<string, SubjectListItem[]>();

  for (const subject of data ?? []) {
    if (subject.slug === null) continue;

    const char = groupChar(subject.name);
    const group = groups.get(char) ?? [];

    group.push({
      ...subject,
      slug: subject.slug,
      guides_total: guideCounts.get(subject.id) ?? 0,
      objectives_total: objectiveCounts.get(subject.id) ?? 0,
    });
    groups.set(char, group);
  }

  // "#" leads, then A-Z.
  return [...groups.entries()]
    .sort(([a], [b]) => {
      if (a === b) return 0;
      if (a === NON_LETTER_GROUP) return -1;
      if (b === NON_LETTER_GROUP) return 1;
      return a.localeCompare(b);
    })
    .map(([char, subjects]) => ({ char, subjects }));
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

// Creates new subject or returns subject if it already exists.
export async function createSubject(
  supabase: DB,
  userId: string,
  name: string,
  summary?: string | null
) {
  const slug = slugify(name);
  if (!slug)
    throw new ServiceError(
      "Subject must contain at least one letter or number",
      400
    );

  const { data: existing, error: findError } = await supabase
    .from("subjects")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();
  if (findError) {
    console.error(findError);
    throw new ServiceError("Failed to resolve subject", 500);
  }
  if (existing) return existing;

  const { data, error } = await supabase
    .from("subjects")
    .insert({ name, summary: summary ?? null, creator_id: userId })
    .select("id, slug, name")
    .single();

  if (error) {
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
  rawSlug: string,
  { page, limit }: Pagination = { page: 1, limit: 20 }
): Promise<{ data: GuideListItem[]; total: number }> {
  const subject = await resolveSubjectId(supabase, rawSlug);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const {
    data,
    count,
    error: guideError,
  } = await supabase
    .from("published_guides")
    .select(PUBLISHED_GUIDE_SELECT, { count: "exact" })
    .contains("subject_ids", [subject.id])
    .order("title")
    .order("id")
    .range(from, to);

  if (guideError) {
    console.error(guideError);
    throw new ServiceError("Failed to load subject guides", 500);
  }

  return {
    data: await buildGuideListItems(supabase, data ?? []),
    total: count ?? 0,
  };
}

export async function listSubjectObjectives(
  supabase: DB,
  rawSlug: string,
  { page, limit }: Pagination = { page: 1, limit: 20 }
): Promise<{ data: ObjectiveListItem[]; total: number }> {
  const subject = await resolveSubjectId(supabase, rawSlug);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const {
    data,
    count,
    error: objError,
  } = await supabase
    .from("objectives")
    .select(
      `id, slug, created_by, created_at, current_revision_id,
       current:objective_revisions!objectives_current_revision_id_fkey!inner(
         title, summary,
         objective_revision_subjects!inner(subject_id)
       )`,
      { count: "exact" }
    )
    .eq("current.objective_revision_subjects.subject_id", subject.id)
    .eq("status", "published")
    .range(from, to);

  if (objError) {
    console.error(objError);
    throw new ServiceError("Failed to load subject objectives", 500);
  }

  // Title lives on the revision and the node -> revision FK is composite
  // (to-many), so PostgREST can't sort the objectives by it. Sort here instead.
  const items = await buildObjectiveListItems(supabase, data ?? []);
  return {
    data: items.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "")),
    total: count ?? 0,
  };
}
