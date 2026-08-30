import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateGuideInput,
  CreateVariantInput,
  Guide,
  GuideListItem,
  GuideReference,
  Pagination,
  SubjectReference,
  Walkthrough,
} from "@bluelearn/schemas";
import type { Database } from "../database.types";
import { ServiceError } from "../lib/service-error";
import { selectInBatches } from "../lib/batch";
import {
  resolveRevisionBase,
  syncDraftTagsAndEdges,
} from "./guide-revision.service";
import { claimTodos } from "./todo.service";
import { readingMinutes } from "../lib/reading";
import { loadUsernames } from "./identity.service";
import { loadDisclaimers, replaceDisclaimers } from "./disclaimer.service";

type DB = SupabaseClient<Database>;

// Names the exact published_guides columns that PUBLISHED_GUIDE_SELECT fetches.
type GuideCardRow = Pick<
  Database["public"]["Views"]["published_guides"]["Row"],
  | "id"
  | "base_slug"
  | "title"
  | "knowledge_type"
  | "status"
  | "created_at"
  | "author_id"
  | "revision_id"
  | "summary"
  | "word_count"
  | "is_official"
>;

// Columns of published_guides a card needs.
export const PUBLISHED_GUIDE_SELECT =
  `id, base_slug, title, knowledge_type, status, created_at,
   author_id, revision_id, summary, word_count, is_official` as const;

type WalkthroughRPC = {
  nodes: (Omit<Walkthrough["nodes"][number], "duration_minutes"> & {
    word_count: number;
  })[];
  edges: Walkthrough["edges"];
};

// A guide's title/summary/body live on the canonical guide's current
// revision, not on the base. This embed walks guide_bases -> canonical
// guide -> its live revision.
const CANONICAL_CONTENT = `
  canonical:guides!guide_bases_canonical_guide_id_fkey(
    id,
    slug,
    author_id,
    current:guide_revisions!guides_current_revision_id_fkey(
      id,
      title,
      summary,
      body,
      word_count,
      created_at
    )
  )
`;

// Get a guide base's tags, which live on its canonical variant's current
// revision.
async function loadCanonicalTags(supabase: DB, revisionId: string | null) {
  if (!revisionId) return [];

  const { data, error } = await supabase
    .from("guide_revision_subjects")
    .select("subjects(id, slug, name)")
    .eq("guide_revision_id", revisionId);

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load guide subjects", 500);
  }
  return (data ?? [])
    .map((r) => r.subjects)
    .filter((s): s is NonNullable<typeof s> & { slug: string } => !!s?.slug);
}

// Resolve a base slug to its id, or 404. Shared by the variant/walkthrough
// reads that key off a base. RLS hides drafts, so an unseen base reads as
// missing.
async function resolveBaseId(supabase: DB, rawSlug: string) {
  const { data, error } = await supabase
    .from("guide_bases")
    .select("id")
    .eq("slug", rawSlug.toLowerCase())
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load guide", 500);
  }
  if (!data) throw new ServiceError("Guide not found", 404);
  return data.id;
}

// Subjects carried by each guide revision. Used to show the
// guide's full tag set even when the list itself was
// filtered to one subject.
async function loadGuideTags(supabase: DB, revisionIds: string[]) {
  const map = new Map<string, SubjectReference[]>();
  if (revisionIds.length === 0) return map;

  const { data, error } = await selectInBatches(revisionIds, (batch) =>
    supabase
      .from("guide_revision_subjects")
      .select("guide_revision_id, subject:subjects(slug, name)")
      .in("guide_revision_id", batch)
  );

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load guide tags", 500);
  }
  for (const row of data ?? []) {
    const subject = row.subject;
    if (!subject?.slug) continue;
    const list = map.get(row.guide_revision_id) ?? [];
    list.push({ slug: subject.slug, name: subject.name });
    map.set(row.guide_revision_id, list);
  }
  for (const list of map.values())
    list.sort((a, b) => a.name.localeCompare(b.name));
  return map;
}

// Assemble card list items from guide_bases rows.
export async function buildGuideListItems(
  supabase: DB,
  rows: GuideCardRow[]
): Promise<GuideListItem[]> {
  const [tagsByRevision, usernames] = await Promise.all([
    loadGuideTags(
      supabase,
      rows.map((r) => r.revision_id!)
    ),
    loadUsernames(
      supabase,
      rows.map((r) => r.author_id)
    ),
  ]);

  return rows.map((card) => ({
    id: card.id!,
    slug: card.base_slug,
    title: card.title,
    knowledge_type: card.knowledge_type!,
    summary: card.summary,
    status: card.status!,
    created_at: card.created_at!,
    author: card.author_id ? (usernames.get(card.author_id) ?? null) : null,
    duration_minutes: readingMinutes(card.word_count ?? 0),
    tags: tagsByRevision.get(card.revision_id!) ?? [],
    is_official: card.is_official!,
  }));
}

// List published guides as cards, alphabetical by title.
export async function listPublishedGuides(
  supabase: DB,
  { page, limit }: Pagination = { page: 1, limit: 20 }
): Promise<{ data: GuideListItem[]; total: number }> {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, count, error } = await supabase
    .from("published_guides")
    .select(PUBLISHED_GUIDE_SELECT, { count: "exact" })
    .order("title")
    .range(from, to);

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load guides", 500);
  }

  return {
    data: await buildGuideListItems(supabase, data ?? []),
    total: count ?? 0,
  };
}

// Create a guide: the create_guide RPC bundles the guide_base + first guide +
// draft revision, then we attach its tags and edges. Returns the draft revision
// id so the client can keep editing or submit it.
export async function createGuide(
  supabase: DB,
  userId: string,
  input: CreateGuideInput
) {
  const {
    title,
    knowledge_type,
    summary,
    body,
    tags,
    prerequisites,
    newSubjects,
    todoPrereqs,
    todoClaims,
    disclaimers,
  } = input;

  const { data: revision_id, error } = await supabase.rpc("create_guide", {
    p_title: title ?? undefined,
    p_knowledge_type: knowledge_type,
    p_summary: summary ?? undefined,
    p_body: body ?? undefined,
  });

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to create guide", 500);
  }

  await syncDraftTagsAndEdges(supabase, userId, revision_id, {
    tags,
    prerequisites,
    newSubjects,
    todoPrereqs,
  });

  if (disclaimers.length > 0) {
    const base = await resolveRevisionBase(supabase, revision_id);
    await replaceDisclaimers(supabase, base.id, disclaimers);
  }

  if (todoClaims.length > 0) {
    const base = await resolveRevisionBase(supabase, revision_id);
    await claimTodos(supabase, base.id, todoClaims);
  }

  return { revision_id };
}

// A base's direct prerequisites.
async function loadPrerequisites(
  supabase: DB,
  baseId: string
): Promise<GuideReference[]> {
  const { data, error } = await supabase
    .from("guide_edges")
    .select(
      `from:guide_bases!from_guide_base_id(
         slug,
         canonical:guides!guide_bases_canonical_guide_id_fkey(
           current:guide_revisions!guides_current_revision_id_fkey(title)
         )
       )`
    )
    .eq("to_guide_base_id", baseId)
    .eq("edge_type", "prerequisite")
    .eq("is_suspended", false);

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load prerequisites", 500);
  }

  return (data ?? [])
    .map((edge) => edge.from)
    .filter((base) => base != null)
    .map((base) => ({
      slug: base.slug ?? "",
      title: base.canonical?.current?.title ?? base.slug ?? "",
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export async function getGuideBySlug(supabase: DB, rawSlug: string) {
  const slug = rawSlug.toLowerCase();

  const { data: guide, error } = await supabase
    .from("guide_bases")
    .select(
      `id, slug, knowledge_type, status, created_at, updated_at, is_official, ${CANONICAL_CONTENT}`
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load guide", 500);
  }
  if (!guide) throw new ServiceError("Guide not found", 404);

  const canonical = guide.canonical;
  const current = canonical?.current ?? null;
  const [subjects, prerequisites, disclaimers] = await Promise.all([
    loadCanonicalTags(supabase, current?.id ?? null),
    loadPrerequisites(supabase, guide.id),
    loadDisclaimers(supabase, guide.id),
  ]);
  const authorId = canonical?.author_id ?? null;
  const usernames = await loadUsernames(supabase, [authorId]);

  const detail: Guide = {
    slug: guide.slug ?? "",
    variant_id: canonical?.id ?? null,
    variant_slug: canonical?.slug ?? null,
    title: current?.title ?? "",
    author: authorId ? (usernames.get(authorId) ?? "") : "",
    knowledge_type: guide.knowledge_type,
    summary: current?.summary ?? null,
    body: current?.body ?? null,
    duration_minutes: readingMinutes(current?.word_count ?? 0),
    created_at: guide.created_at,
    tags: subjects.map((s) => ({ slug: s.slug, name: s.name })),
    prerequisites,
    is_official: guide.is_official,
    disclaimers,
  };

  return detail;
}

// Archive the guide. Per RLS this is moderator/admin-only (authors cannot move
// a guide off 'draft'); a non-permitted caller simply matches zero rows.
export async function archiveGuide(supabase: DB, rawSlug: string) {
  const slug = rawSlug.toLowerCase();

  const { data, error } = await supabase
    .from("guide_bases")
    .update({ status: "archived" })
    .eq("slug", slug)
    .select("id, slug, status");

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to archive guide", 500);
  }
  if (!data || data.length === 0) {
    throw new ServiceError("Guide not found or not permitted", 404);
  }
  return data[0];
}

// Build the target's transitive prerequisite DAG (nodes + edges, RLS-filtered)
// via the compute_walkthrough RPC.
export async function getWalkthrough(supabase: DB, rawSlug: string) {
  const baseId = await resolveBaseId(supabase, rawSlug);

  const { data, error } = await supabase.rpc("compute_walkthrough", {
    p_guide_base_id: baseId,
  });

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to compute walkthrough", 500);
  }

  const { nodes, edges } = data as unknown as WalkthroughRPC;
  return {
    nodes: nodes.map(({ word_count, ...node }) => ({
      ...node,
      duration_minutes: readingMinutes(word_count),
    })),
    edges,
  } satisfies Walkthrough;
}

type VariantMetadata = {
  author: string | null;
  updated_at: string | null;
  votes: { up: number; down: number };
};

const EMPTY_VARIANT_METADATA: VariantMetadata = {
  author: null,
  updated_at: null,
  votes: { up: 0, down: 0 },
};

// Author, last updated date, and vote tally for a page of variants.
async function loadVariantMetadata(supabase: DB, ids: string[]) {
  const map = new Map<string, VariantMetadata>();
  if (ids.length === 0) return map;

  const [rows, tallies] = await Promise.all([
    supabase
      .from("guides")
      .select(
        `id, author_id,
         current:guide_revisions!guides_current_revision_id_fkey(created_at, approved_at)`
      )
      .in("id", ids),
    supabase
      .from("guide_vote_tallies")
      .select("guide_id, upvotes, downvotes")
      .in("guide_id", ids),
  ]);

  if (rows.error || tallies.error) {
    console.error(rows.error ?? tallies.error);
    throw new ServiceError("Failed to load variants", 500);
  }

  const usernames = await loadUsernames(
    supabase,
    (rows.data ?? []).map((r) => r.author_id)
  );
  const tallyByGuide = new Map(
    (tallies.data ?? []).map((t) => [t.guide_id, t])
  );

  for (const row of rows.data ?? []) {
    const tally = row.id ? tallyByGuide.get(row.id) : null;
    map.set(row.id, {
      author: row.author_id ? (usernames.get(row.author_id) ?? null) : null,
      updated_at: row.current?.approved_at ?? row.current?.created_at ?? null,
      votes: { up: tally?.upvotes ?? 0, down: tally?.downvotes ?? 0 },
    });
  }
  return map;
}

// List the published variants (methods/alternatives) under a guide, ranked
// by Wilson score lower bound
export async function listGuideVariants(
  supabase: DB,
  rawSlug: string,
  { page, limit }: Pagination = { page: 1, limit: 20 }
) {
  const baseId = await resolveBaseId(supabase, rawSlug);

  const { data, error } = await supabase.rpc("list_guide_variants_by_score", {
    p_guide_base_id: baseId,
  });

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load variants", 500);
  }

  const { data: base, error: baseError } = await supabase
    .from("guide_bases")
    .select("canonical_guide_id")
    .eq("id", baseId)
    .maybeSingle();

  if (baseError) {
    console.error(baseError);
    throw new ServiceError("Failed to load variants", 500);
  }

  const canonicalId = base?.canonical_guide_id ?? null;
  const scored = data ?? [];
  const all = canonicalId
    ? [
        ...scored.filter((v) => v.id === canonicalId),
        ...scored.filter((v) => v.id !== canonicalId),
      ]
    : scored;
  const from = (page - 1) * limit;
  const to = from + limit;
  const pageRows = all.slice(from, to);
  const metadata = await loadVariantMetadata(
    supabase,
    pageRows.map((v) => v.id)
  );

  return {
    data: pageRows.map((variant) => ({
      ...variant,
      is_canonical: variant.id === canonicalId,
      ...(metadata.get(variant.id) ?? EMPTY_VARIANT_METADATA),
    })),
    total: all.length,
  };
}

// Add a variant under a guide: a draft guide + first revision via the
// create_variant RPC. Returns the draft revision id so the client routes to its
// editor.
export async function addGuideVariant(
  supabase: DB,
  userId: string,
  rawSlug: string,
  input: CreateVariantInput
) {
  const baseId = await resolveBaseId(supabase, rawSlug);

  const { data: revision_id, error } = await supabase.rpc("create_variant", {
    p_guide_base_id: baseId,
    p_title: input.title ?? undefined,
    p_summary: input.summary ?? undefined,
    p_body: input.body ?? undefined,
  });

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to add variant", 500);
  }

  // Prereqs and todos aren't include because those are inherited from shared base.
  await syncDraftTagsAndEdges(supabase, userId, revision_id, {
    tags: input.tags,
    newSubjects: input.newSubjects,
  });

  return { revision_id };
}

// Resolve a base + variant slug pair to the variant's content and public vote
// tally. Drafts carry no slug, so this only ever resolves published variants.
export async function getVariantBySlug(
  supabase: DB,
  rawSlug: string,
  rawVariantSlug: string
) {
  const baseId = await resolveBaseId(supabase, rawSlug);

  const { data: variant, error } = await supabase
    .from("guides")
    .select(
      `id, guide_base_id, slug, status, author_id,
       base:guide_bases!guides_guide_base_id_fkey(is_official, knowledge_type),
       current:guide_revisions!guides_current_revision_id_fkey(id, title, summary, body, word_count, created_at)`
    )
    .eq("guide_base_id", baseId)
    .eq("slug", rawVariantSlug.toLowerCase())
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load variant", 500);
  }
  if (!variant) throw new ServiceError("Variant not found", 404);
  if (variant.status === "archived") {
    throw new ServiceError("Variant not found", 404);
  }

  const [{ data: tally, error: tallyError }, tags, usernames, disclaimers] =
    await Promise.all([
      supabase
        .from("guide_vote_tallies")
        .select("upvotes, downvotes")
        .eq("guide_id", variant.id)
        .maybeSingle(),
      loadCanonicalTags(supabase, variant.current?.id ?? null),
      loadUsernames(supabase, [variant.author_id]),
      loadDisclaimers(supabase, variant.guide_base_id),
    ]);

  if (tallyError) {
    console.error(tallyError);
    throw new ServiceError("Failed to load vote tally", 500);
  }

  const { author_id, current, base, ...rest } = variant;

  return {
    variant: {
      ...rest,
      current: current
        ? {
            id: current.id,
            title: current.title,
            summary: current.summary,
            body: current.body,
            created_at: current.created_at,
          }
        : null,
      author: author_id ? (usernames.get(author_id) ?? "") : "",
      tags: tags.map((s) => ({ slug: s.slug, name: s.name })),
      duration_minutes: readingMinutes(current?.word_count ?? 0),
      votes: { up: tally?.upvotes ?? 0, down: tally?.downvotes ?? 0 },
      is_official: base?.is_official ?? false,
      knowledge_type: base?.knowledge_type ?? "theoretical",
      disclaimers,
    },
  };
}

// List published objectives that include this guide base in their current revision.
export async function listObjectivesForGuide(supabase: DB, rawSlug: string) {
  const baseId = await resolveBaseId(supabase, rawSlug);

  const { data: nodes, error: nodeError } = await supabase
    .from("objective_revision_nodes")
    .select("revision_id")
    .eq("guide_base_id", baseId);

  if (nodeError) {
    console.error(nodeError);
    throw new ServiceError("Failed to load objectives for guide", 500);
  }

  const revisionIds = [...new Set((nodes ?? []).map((n) => n.revision_id))];
  if (revisionIds.length === 0) return { objectives: [], total: 0 };

  const { data: objectives, error: objError } = await selectInBatches(
    revisionIds,
    (batch) =>
      supabase
        .from("objectives")
        .select(
          `id, slug, status,
       current:objective_revisions!objectives_current_revision_id_fkey(title, summary, author_id, published_at, created_at)`
        )
        .in("current_revision_id", batch)
        .eq("status", "published")
  );

  if (objError) {
    console.error(objError);
    throw new ServiceError("Failed to load objectives for guide", 500);
  }

  const usernames = await loadUsernames(
    supabase,
    (objectives ?? []).map((o) => o.current?.author_id ?? null)
  );

  const list = (objectives ?? [])
    .filter((o) => o.slug !== null)
    .map((o) => ({
      id: o.id,
      slug: o.slug!,
      title: o.current?.title ?? "",
      summary: o.current?.summary ?? null,
      author: o.current?.author_id
        ? (usernames.get(o.current.author_id) ?? null)
        : null,
      updated_at: o.current?.published_at ?? o.current?.created_at ?? null,
    }));

  return { objectives: list, total: list.length };
}
