import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateObjectiveInput,
  FeaturedNode,
  ObjectiveListItem,
} from "@bluelearn/schemas";
import type { Database } from "../database.types";
import { ServiceError } from "../lib/service-error";
import { readingMinutes } from "../lib/reading";
import { getRevisionSnapshot } from "./objective-revision.service";
import { loadUsernames } from "./identity.service";

type DB = SupabaseClient<Database>;

// The row shape buildObjectiveListItems needs.
type ObjectiveCardRow = {
  id: string;
  slug: string | null;
  created_by: string | null;
  created_at: string;
  current_revision_id: string | null;
  current: { title: string | null; summary: string | null } | null;
};

// This embed walks objectives -> current revision through the live pointer FK.
const CURRENT_META = `
  current:objective_revisions!objectives_current_revision_id_fkey(
    title,
    summary
  )
`;

// Resolve a objective slug to its id + live revision, or 404. RLS hides drafts, so an
// unseen objective reads as missing. A published objective always carries a slug and a
// current_revision_id, so this only resolves live objectives.
async function resolveObjective(supabase: DB, rawSlug: string) {
  const { data, error } = await supabase
    .from("objectives")
    .select("id, current_revision_id")
    .eq("slug", rawSlug.toLowerCase())
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load objective", 500);
  }
  if (!data) throw new ServiceError("Objective not found", 404);
  return data;
}

type ObjectiveCardData = Pick<
  ObjectiveListItem,
  "guides_total" | "duration_minutes" | "featured_sub_objective"
>;
type CardNode = {
  id: string;
  slug: string | null;
  title: string | null;
  is_featured: boolean;
};
type NodeOrder = {
  target_node_id: string;
  node_id: string;
  position: number;
};

function buildFeaturedSubObjective(
  nodes: CardNode[],
  orders: NodeOrder[]
): FeaturedNode[] {
  const featured = nodes.find((n) => n.is_featured);
  if (!featured) return [];

  const byId = new Map(nodes.map((n) => [n.id, n]));
  return orders
    .filter((o) => o.target_node_id === featured.id)
    .sort((a, b) => a.position - b.position)
    .map((o, i) => {
      const node = byId.get(o.node_id);
      return {
        position: i + 1,
        slug: node?.slug ?? null,
        title: node?.title ?? null,
      };
    });
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

async function loadGuideWordCounts(supabase: DB, guideIds: string[]) {
  const map = new Map<string, number>();
  if (guideIds.length === 0) return map;

  const { data, error } = await supabase
    .from("guides")
    .select(
      "id, current:guide_revisions!guides_current_revision_id_fkey(word_count)"
    )
    .in("id", guideIds);

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load objective guides", 500);
  }
  for (const g of data ?? []) map.set(g.id, g.current?.word_count ?? 0);
  return map;
}

// Per-objective card figures (guide tally, reading duration, featured
// sub-objective).
async function loadObjectiveCards(supabase: DB, revisionIds: string[]) {
  const cards = new Map<string, ObjectiveCardData>();
  if (revisionIds.length === 0) return cards;

  const [nodesRes, ordersRes] = await Promise.all([
    supabase
      .from("objective_revision_nodes")
      .select(
        "revision_id, id, guide_base_id, guide_id, is_featured, is_included"
      )
      .in("revision_id", revisionIds),
    supabase
      .from("objective_revision_node_orders")
      .select("revision_id, target_node_id, node_id, position")
      .in("revision_id", revisionIds),
  ]);

  if (nodesRes.error) {
    console.error(nodesRes.error);
    throw new ServiceError("Failed to load objective nodes", 500);
  }
  if (ordersRes.error) {
    console.error(ordersRes.error);
    throw new ServiceError("Failed to load objective node orders", 500);
  }

  const nodeRows = nodesRes.data ?? [];
  const allBaseIds = [...new Set(nodeRows.map((n) => n.guide_base_id))];
  const guideIds = [
    ...new Set(nodeRows.filter((n) => n.is_included).map((n) => n.guide_id)),
  ];

  const [baseMeta, wordsByGuide] = await Promise.all([
    loadGuideBaseMeta(supabase, allBaseIds),
    loadGuideWordCounts(supabase, guideIds),
  ]);

  for (const revisionId of revisionIds) {
    const revisionNodes = nodeRows.filter((n) => n.revision_id === revisionId);
    const nodes: CardNode[] = revisionNodes.map((n) => ({
      id: n.id,
      slug: baseMeta.get(n.guide_base_id)?.slug ?? null,
      title: baseMeta.get(n.guide_base_id)?.title ?? null,
      is_featured: n.is_featured,
    }));
    const orders = (ordersRes.data ?? []).filter(
      (o) => o.revision_id === revisionId
    );
    const words = revisionNodes
      .filter((n) => n.is_included)
      .reduce((sum, n) => sum + (wordsByGuide.get(n.guide_id) ?? 0), 0);

    cards.set(revisionId, {
      guides_total: revisionNodes.filter((n) => n.is_included).length,
      duration_minutes: readingMinutes(words),
      featured_sub_objective: buildFeaturedSubObjective(nodes, orders),
    });
  }

  return cards;
}

// Assemble card list items from objectives rows.
export async function buildObjectiveListItems(
  supabase: DB,
  rows: ObjectiveCardRow[]
): Promise<ObjectiveListItem[]> {
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

  return rows.map((row) => {
    const card = row.current_revision_id
      ? cards.get(row.current_revision_id)
      : undefined;
    return {
      id: row.id,
      slug: row.slug,
      title: row.current?.title ?? null,
      summary: row.current?.summary ?? null,
      curator: row.created_by ? (usernames.get(row.created_by) ?? null) : null,
      created_at: row.created_at,
      guides_total: card?.guides_total ?? 0,
      duration_minutes: card?.duration_minutes ?? 0,
      featured_sub_objective: card?.featured_sub_objective ?? [],
    };
  });
}

// List published objectives as cards, newest first. RLS hides drafts from
// non-authors.
export async function listPublishedObjectives(
  supabase: DB
): Promise<ObjectiveListItem[]> {
  const { data, error } = await supabase
    .from("objectives")
    .select(
      `id, slug, created_by, created_at, current_revision_id, ${CURRENT_META}`
    )
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load objectives", 500);
  }

  return buildObjectiveListItems(supabase, data ?? []);
}

// Create a objective: bundles the objective shell + revision 1 + the targets' prerequisite
// closure as the initial node set in one transaction via the create_objective
// RPC (RLS still applies, SECURITY INVOKER). Returns the draft revision id so the
// client routes straight to its editor.
export async function createObjective(
  supabase: DB,
  input: CreateObjectiveInput
) {
  const { data: revision_id, error } = await supabase.rpc("create_objective", {
    p_targets: input.target_ids,
    p_title: input.title ?? undefined,
    p_summary: input.summary ?? undefined,
  });

  if (error) {
    // RLS restricts objective creation to curators; a denied insert surfaces as 42501.
    if (error.code === "42501")
      throw new ServiceError("Not permitted to create a objective", 403);
    console.error(error);
    throw new ServiceError("Failed to create objective", 500);
  }
  return { revision_id };
}

// Resolve a objective by slug. Includes every node (included or skipped) and both the
// frozen projected edges and the live raw edges. Same { metadata, snapshot } shape
// the revision endpoint returns, keyed on the objective instead of a revision.
export async function getObjectiveBySlug(supabase: DB, rawSlug: string) {
  const slug = rawSlug.toLowerCase();

  const { data: row, error } = await supabase
    .from("objectives")
    .select(`id, slug, status, current_revision_id, ${CURRENT_META}`)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load objective", 500);
  }
  if (!row || !row.current_revision_id)
    throw new ServiceError("Objective not found", 404);

  const { current, ...base } = row;
  const objective = {
    ...base,
    title: current?.title ?? null,
    summary: current?.summary ?? null,
  };

  const snapshot = await getRevisionSnapshot(supabase, row.current_revision_id);
  return { objective, snapshot };
}

// Archive the objective. Per RLS this is curator(owner)/moderator-only; a non-permitted
// caller simply matches zero rows and reads as not found.
export async function archiveObjective(supabase: DB, rawSlug: string) {
  const { data, error } = await supabase
    .from("objectives")
    .update({ status: "archived" })
    .eq("slug", rawSlug.toLowerCase())
    .select("id, slug, status");

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to archive objective", 500);
  }
  if (!data || data.length === 0) {
    throw new ServiceError("Objective not found or not permitted", 404);
  }
  return data[0];
}

// The objective's revision history, newest first. Drafts (null published_at) sort by
// creation alongside published ones.
export async function listObjectiveRevisions(supabase: DB, rawSlug: string) {
  const { id } = await resolveObjective(supabase, rawSlug);

  const { data, error } = await supabase
    .from("objective_revisions")
    .select("id, title, change_summary, status, created_at, published_at")
    .eq("objective_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load revisions", 500);
  }
  return data ?? [];
}

// Compute the graph data for a specific objective, including node levels, word_count, and tags.
// Formats the data to match the WalkthroughData interface for the frontend graph view.
export async function getObjectiveGraphData(supabase: DB, rawSlug: string) {
  const { snapshot } = await getObjectiveBySlug(supabase, rawSlug);

  const includedNodes = snapshot.nodes.filter((n) => n.is_included);
  const guideIds = includedNodes.map((n) => n.guide_id);
  const baseIds = includedNodes.map((n) => n.guide_base_id);

  // Fetch word_count and summary for the specific guides
  const { data: guideData, error: guideError } = await supabase
    .from("guides")
    .select(
      "id, current:guide_revisions!guides_current_revision_id_fkey(summary, word_count, id)"
    )
    .in("id", guideIds);

  if (guideError) {
    console.error(guideError);
    throw new ServiceError("Failed to load guide details", 500);
  }

  const guideDetailsMap = new Map();
  const revisionIds = [];
  for (const row of guideData ?? []) {
    if (row.current) {
      guideDetailsMap.set(row.id, row.current);
      revisionIds.push(row.current.id);
    }
  }

  // Fetch tags
  const tagsMap = new Map();
  if (revisionIds.length > 0) {
    const { data: tagData, error: tagError } = await supabase
      .from("guide_revision_subjects")
      .select("guide_revision_id, subject:subjects(slug, name)")
      .in("guide_revision_id", revisionIds);

    if (tagError) {
      console.error(tagError);
      throw new ServiceError("Failed to load guide tags", 500);
    }

    for (const row of tagData ?? []) {
      if (row.subject) {
        if (!tagsMap.has(row.guide_revision_id))
          tagsMap.set(row.guide_revision_id, []);
        tagsMap.get(row.guide_revision_id).push(row.subject);
      }
    }
  }

  // Build adj list for level computation
  const adj = new Map<string, string[]>(); // from -> to[]
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();

  for (const id of baseIds) {
    adj.set(id, []);
    inDegree.set(id, 0);
    outDegree.set(id, 0);
  }

  const edges = snapshot.projected_edges.filter(
    (e) => adj.has(e.from_id) && adj.has(e.to_id)
  );

  for (const e of edges) {
    adj.get(e.from_id)!.push(e.to_id);
    inDegree.set(e.to_id, inDegree.get(e.to_id)! + 1);
    outDegree.set(e.from_id, outDegree.get(e.from_id)! + 1);
  }

  const levels = new Map<string, number>();
  // Kahn's or simple forward walk
  // Initialize roots
  const queue: string[] = [];
  for (const id of baseIds) {
    if (inDegree.get(id) === 0) {
      levels.set(id, 1);
      queue.push(id);
    }
  }

  let maxLevel = 1;
  while (queue.length > 0) {
    const u = queue.shift()!;
    const uLevel = levels.get(u)!;
    for (const v of adj.get(u)!) {
      const vLevel = levels.get(v) || 1;
      if (uLevel + 1 > vLevel) {
        levels.set(v, uLevel + 1);
        if (uLevel + 1 > maxLevel) maxLevel = uLevel + 1;
      }
      const deg = inDegree.get(v)! - 1;
      inDegree.set(v, deg);
      if (deg === 0) {
        queue.push(v);
      }
    }
  }

  const nodes = includedNodes.map((n) => {
    const details = guideDetailsMap.get(n.guide_id);
    const tags = details ? tagsMap.get(details.id) || [] : [];
    return {
      id: n.guide_base_id,
      slug: n.slug,
      title: n.title,
      summary: details?.summary ?? null,
      level: levels.get(n.guide_base_id) || 1,
      word_count: details?.word_count ?? 0,
      tags: tags,
      is_target: n.is_target,
    };
  });

  return { nodes, edges };
}
