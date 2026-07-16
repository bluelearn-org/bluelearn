import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { ServiceError } from "../lib/service-error";
import { slugify } from "../lib/slug";
import { countWords, readingMinutes } from "../lib/reading";

type DB = SupabaseClient<Database>;
type PathStep = { position: number; slug: string | null; title: string | null };
type ObjectiveCardData = {
  guides_total: number;
  duration_minutes: number;
  featured_path: PathStep[];
};
type CardNode = {
  base_id: string;
  slug: string | null;
  title: string | null;
  is_featured: boolean;
  is_target: boolean;
};

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

// Map profile ids to their @username. Cards show the original author/curator, so
// callers pass first-revision author ids and read the handle back from here.
async function loadUsernames(supabase: DB, ids: Array<string | null>) {
  const map = new Map<string, string>();
  const unique = [...new Set(ids.filter((id): id is string => id !== null))];
  if (unique.length === 0) return map;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", unique);

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load authors", 500);
  }
  for (const p of data ?? []) map.set(p.id, p.username);
  return map;
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

export async function listSubjects(supabase: DB) {
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

// Subject slugs carried by each guide revision, keyed by revision id. The
// listing filter narrows to one subject, so the guide's full tag set is loaded
// here separately.
async function loadGuideTags(supabase: DB, revisionIds: string[]) {
  const map = new Map<string, string[]>();
  if (revisionIds.length === 0) return map;

  const { data, error } = await supabase
    .from("guide_revision_subjects")
    .select("guide_revision_id, subject:subjects(slug)")
    .in("guide_revision_id", revisionIds);

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load guide tags", 500);
  }
  for (const row of data ?? []) {
    const slug = row.subject?.slug;
    if (!slug) continue;
    const list = map.get(row.guide_revision_id) ?? [];
    list.push(slug);
    map.set(row.guide_revision_id, list);
  }
  for (const list of map.values()) list.sort();
  return map;
}

export async function listSubjectGuides(supabase: DB, rawSlug: string) {
  const subject = await resolveSubjectId(supabase, rawSlug);

  const { data, error: guideError } = await supabase
    .from("guide_bases")
    .select(
      `id, slug, title, status, created_at,
       canonical:guides!guide_bases_canonical_guide_id_fkey!inner(
         author_id,
         current:guide_revisions!guides_current_revision_id_fkey!inner(
           id, summary, body,
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

  const rows = data ?? [];
  const [tagsByRevision, usernames] = await Promise.all([
    loadGuideTags(
      supabase,
      rows.map((r) => r.canonical.current.id)
    ),
    loadUsernames(
      supabase,
      rows.map((r) => r.canonical.author_id)
    ),
  ]);

  return rows.map((base) => {
    const current = base.canonical.current;
    const authorId = base.canonical.author_id;
    return {
      id: base.id,
      slug: base.slug,
      title: base.title,
      summary: current.summary ?? null,
      status: base.status,
      created_at: base.created_at,
      author: authorId ? (usernames.get(authorId) ?? null) : null,
      duration_minutes: readingMinutes(countWords(current.body)),
      tags: tagsByRevision.get(current.id) ?? [],
    };
  });
}

// The featured target plus the guides leading up to it.
function buildFeaturedPath(
  nodes: CardNode[],
  edges: Array<{ from: string; to: string }>
): PathStep[] {
  if (nodes.length === 0) return [];
  const target =
    nodes.find((n) => n.is_featured) ??
    nodes.find((n) => n.is_target) ??
    nodes[nodes.length - 1];

  const prerequisitesOf = new Map<string, string[]>();
  for (const e of edges) {
    const list = prerequisitesOf.get(e.to) ?? [];
    list.push(e.from);
    prerequisitesOf.set(e.to, list);
  }

  const depth = new Map<string, number>([[target.base_id, 0]]);
  const queue = [target.base_id];
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    for (const prev of prerequisitesOf.get(cur) ?? []) {
      const next = (depth.get(cur) ?? 0) + 1;
      if (next > (depth.get(prev) ?? -1)) {
        depth.set(prev, next);
        queue.push(prev);
      }
    }
  }

  const byBase = new Map(nodes.map((n) => [n.base_id, n]));
  return [...depth.entries()]
    .map(([baseId, d]) => ({ node: byBase.get(baseId), d }))
    .filter((x): x is { node: CardNode; d: number } => x.node !== undefined)
    .sort((a, b) => b.d - a.d)
    .map(({ node }, i) => ({
      position: i + 1,
      slug: node.slug,
      title: node.title,
    }));
}

// Per-objective card figures (guide tally, reading duration, featured path),
// keyed by the current revision id and batched across every listed objective.
async function loadObjectiveCards(supabase: DB, revisionIds: string[]) {
  const cards = new Map<string, ObjectiveCardData>();
  if (revisionIds.length === 0) return cards;

  const [nodesRes, edgesRes] = await Promise.all([
    supabase
      .from("objective_revision_nodes")
      .select(
        "revision_id, guide_base_id, guide_id, is_featured, is_target, is_included"
      )
      .in("revision_id", revisionIds),
    supabase
      .from("objective_revision_edges")
      .select("revision_id, from_guide_base_id, to_guide_base_id")
      .in("revision_id", revisionIds),
  ]);

  if (nodesRes.error) {
    console.error(nodesRes.error);
    throw new ServiceError("Failed to load objective nodes", 500);
  }
  if (edgesRes.error) {
    console.error(edgesRes.error);
    throw new ServiceError("Failed to load objective edges", 500);
  }

  const nodeRows = (nodesRes.data ?? []).filter((n) => n.is_included);
  const baseIds = [...new Set(nodeRows.map((n) => n.guide_base_id))];
  const guideIds = [...new Set(nodeRows.map((n) => n.guide_id))];

  const [baseMeta, wordsByGuide] = await Promise.all([
    loadGuideBaseMeta(supabase, baseIds),
    loadGuideWordCounts(supabase, guideIds),
  ]);

  for (const revisionId of revisionIds) {
    const nodes: CardNode[] = nodeRows
      .filter((n) => n.revision_id === revisionId)
      .map((n) => ({
        base_id: n.guide_base_id,
        slug: baseMeta.get(n.guide_base_id)?.slug ?? null,
        title: baseMeta.get(n.guide_base_id)?.title ?? null,
        is_featured: n.is_featured,
        is_target: n.is_target,
      }));
    const edges = (edgesRes.data ?? [])
      .filter((e) => e.revision_id === revisionId)
      .map((e) => ({ from: e.from_guide_base_id, to: e.to_guide_base_id }));
    const words = nodeRows
      .filter((n) => n.revision_id === revisionId)
      .reduce((sum, n) => sum + (wordsByGuide.get(n.guide_id) ?? 0), 0);

    cards.set(revisionId, {
      guides_total: nodes.length,
      duration_minutes: readingMinutes(words),
      featured_path: buildFeaturedPath(nodes, edges),
    });
  }

  return cards;
}

async function loadGuideBaseMeta(supabase: DB, baseIds: string[]) {
  const map = new Map<string, { slug: string | null; title: string | null }>();
  if (baseIds.length === 0) return map;

  const { data, error } = await supabase
    .from("guide_bases")
    .select("id, slug, title")
    .in("id", baseIds);

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load objective guides", 500);
  }
  for (const b of data ?? []) map.set(b.id, { slug: b.slug, title: b.title });
  return map;
}

// Word count of each node guide's live body, keyed by guide id, for the
// objective's summed reading duration.
async function loadGuideWordCounts(supabase: DB, guideIds: string[]) {
  const map = new Map<string, number>();
  if (guideIds.length === 0) return map;

  const { data, error } = await supabase
    .from("guides")
    .select("id, current:guide_revisions!guides_current_revision_id_fkey(body)")
    .in("id", guideIds);

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load objective guides", 500);
  }
  for (const g of data ?? []) map.set(g.id, countWords(g.current?.body));
  return map;
}

export async function listSubjectObjectives(supabase: DB, rawSlug: string) {
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

  const rows = data ?? [];
  const [cards, usernames] = await Promise.all([
    loadObjectiveCards(
      supabase,
      rows
        .map((r) => r.current_revision_id)
        .filter((id): id is string => id !== null)
    ),
    loadUsernames(
      supabase,
      rows.map((r) => r.created_by)
    ),
  ]);

  // Title lives on the revision and the node -> revision FK is composite
  // (to-many), so PostgREST can't sort the objectives by it. Sort here instead.
  return rows
    .map((row) => {
      const card = row.current_revision_id
        ? cards.get(row.current_revision_id)
        : undefined;
      return {
        id: row.id,
        slug: row.slug,
        title: row.current?.title ?? null,
        summary: row.current?.summary ?? null,
        curator: row.created_by
          ? (usernames.get(row.created_by) ?? null)
          : null,
        created_at: row.created_at,
        guides_total: card?.guides_total ?? 0,
        duration_minutes: card?.duration_minutes ?? 0,
        featured_path: card?.featured_path ?? [],
      };
    })
    .sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
}
