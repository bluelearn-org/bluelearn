import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateGuideInput,
  CreateVariantInput,
  GuideListItem,
} from "@bluelearn/schemas";
import type { Database } from "../database.types";
import { ServiceError } from "../lib/service-error";
import { readingMinutes } from "../lib/reading";
import { loadUsernames } from "./identity.service";

type DB = SupabaseClient<Database>;

// The guide_bases row shape every card listing selects.
type GuideCardRow = {
  id: string;
  slug: string | null;
  title: string | null;
  knowledge_type: Database["public"]["Enums"]["knowledge_type"];
  status: Database["public"]["Enums"]["node_status"];
  created_at: string;
  canonical: {
    author_id: string | null;
    current: { id: string; summary: string | null; word_count: number };
  };
};

// Shape of compute_walkthrough's jsonb payload. Narrowing the RPC's recursive
// Json return gives the route (and the typed client) a concrete shape.
type Walkthrough = {
  nodes: {
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    depth: number;
  }[];
  edges: { from_id: string; to_id: string }[];
};

// A guide's title/summary/body live on the canonical guide's current
// revision, not on the base. This embed walks guide_bases -> canonical
// guide -> its live revision.
const CANONICAL_CONTENT = `
  canonical:guides!guide_bases_canonical_guide_id_fkey(
    id,
    slug,
    current:guide_revisions!guides_current_revision_id_fkey(
      id,
      title,
      summary,
      body,
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
  return (data ?? []).map((r) => r.subjects).filter((s) => s !== null);
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

// Subject slugs carried by each guide revision, keyed by revision id. Card
// listings show the guide's full tag set regardless of how they filtered.
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

// Assemble card list items from guide_bases rows.
export async function buildGuideListItems(
  supabase: DB,
  rows: GuideCardRow[]
): Promise<GuideListItem[]> {
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
      knowledge_type: base.knowledge_type,
      summary: current.summary,
      status: base.status,
      created_at: base.created_at,
      author: authorId ? (usernames.get(authorId) ?? null) : null,
      duration_minutes: readingMinutes(current.word_count),
      tags: tagsByRevision.get(current.id) ?? [],
    };
  });
}

// List published guides as cards, alphabetical. RLS hides drafts from
// non-authors.
export async function listPublishedGuides(
  supabase: DB
): Promise<GuideListItem[]> {
  const { data, error } = await supabase
    .from("guide_bases")
    .select(
      `id, slug, title, knowledge_type, status, created_at,
       canonical:guides!guide_bases_canonical_guide_id_fkey!inner(
         author_id,
         current:guide_revisions!guides_current_revision_id_fkey!inner(
           id, summary, word_count
         )
       )`
    )
    .eq("status", "published")
    .order("title");

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load guides", 500);
  }

  return buildGuideListItems(supabase, data ?? []);
}

// Create a guide: bundles the guide_base + first guide + draft revision in one
// transaction via the create_guide RPC (RLS still applies, SECURITY INVOKER).
// The draft starts empty (title/slug filled in the editor); returns the draft
// revision id so the client can route to its editor.
export async function createGuide(supabase: DB, input: CreateGuideInput) {
  const { title, knowledge_type, summary, body } = input;

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

  return { revision_id };
}

// Resolve a guide by slug to its canonical content + subject tags. The prereq/
// dependent neighborhood is deferred to the graph pass.
export async function getGuideBySlug(supabase: DB, rawSlug: string) {
  const slug = rawSlug.toLowerCase();

  const { data: guide, error } = await supabase
    .from("guide_bases")
    .select(
      `id, slug, title, knowledge_type, status, created_at, updated_at, ${CANONICAL_CONTENT}`
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load guide", 500);
  }
  if (!guide) throw new ServiceError("Guide not found", 404);

  const subjects = await loadCanonicalTags(
    supabase,
    guide.canonical?.current?.id ?? null
  );

  return { guide, subjects };
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
  return data as unknown as Walkthrough;
}

// List the published variants (methods/alternatives) under a guide. Title and
// summary live on each variant's live revision.
export async function listGuideVariants(supabase: DB, rawSlug: string) {
  const baseId = await resolveBaseId(supabase, rawSlug);

  const { data, error } = await supabase
    .from("guides")
    .select(
      `id, slug, current:guide_revisions!guides_current_revision_id_fkey(title, summary)`
    )
    .eq("guide_base_id", baseId)
    .eq("status", "published")
    .order("slug");

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load variants", 500);
  }

  return (data ?? []).map(({ current, ...variant }) => ({
    ...variant,
    title: current?.title ?? null,
    summary: current?.summary ?? null,
  }));
}

// Add a variant under a guide: a draft guide + first revision via the
// create_variant RPC. Returns the draft revision id so the client routes to its
// editor.
export async function addGuideVariant(
  supabase: DB,
  rawSlug: string,
  input: CreateVariantInput
) {
  const baseId = await resolveBaseId(supabase, rawSlug);

  const { data: revision_id, error } = await supabase.rpc("create_variant", {
    p_guide_base_id: baseId,
    p_title: input.title,
    p_summary: input.summary ?? undefined,
    p_body: input.body ?? undefined,
  });

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to add variant", 500);
  }
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
      `id, guide_base_id, slug, status,
       current:guide_revisions!guides_current_revision_id_fkey(id, title, summary, body, created_at)`
    )
    .eq("guide_base_id", baseId)
    .eq("slug", rawVariantSlug.toLowerCase())
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load variant", 500);
  }
  if (!variant) throw new ServiceError("Variant not found", 404);

  const { data: tally, error: tallyError } = await supabase
    .from("guide_vote_tallies")
    .select("upvotes, downvotes")
    .eq("guide_id", variant.id)
    .maybeSingle();

  if (tallyError) {
    console.error(tallyError);
    throw new ServiceError("Failed to load vote tally", 500);
  }

  return {
    variant: {
      ...variant,
      votes: { up: tally?.upvotes ?? 0, down: tally?.downvotes ?? 0 },
    },
  };
}
