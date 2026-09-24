import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ObjectiveGraphInput,
  ObjectiveTargetInput,
  UpdateObjectiveNodeInput,
  UpdateObjectiveRevisionInput,
} from "@bluelearn/schemas";
import type { Database } from "../database.types";
import { ServiceError } from "../lib/service-error";
import { selectInBatches } from "../lib/batch";
import { diffField, diffSequences } from "../lib/diff";

type DB = SupabaseClient<Database>;

const REVISION_META =
  "id, title, summary, change_summary, status, created_at, published_at, updated_at";

const NODE_COLS =
  "id, guide_base_id, guide_id, is_target, is_included, is_featured, target_position, note";

// Adds author_id for the diff's RevisionRef header and keeps status so we know
// whether to load edges frozen (published) or live (draft). Drops
// published_at/updated_at which the diff response does not surface.
const DIFF_REVISION_META =
  "id, author_id, title, summary, change_summary, status, created_at";

// All of a revision's nodes (included or skipped), the curator's linear order
// under each target, plus the projected edges (the bridged projection over
// included nodes) and the raw prerequisite edges among every node, read live
// from the guide graph.
export async function getRevisionSnapshot(
  supabase: DB,
  revisionId: string,
  projectedSource: "frozen" | "live" = "frozen"
) {
  const { data: nodeRows, error: nodeError } = await supabase
    .from("objective_revision_nodes")
    .select(`${NODE_COLS}, request_id, title, summary`)
    .eq("revision_id", revisionId);

  if (nodeError) {
    console.error(nodeError);
    throw new ServiceError("Failed to load revision", 500);
  }

  const baseIds = (nodeRows ?? [])
    .filter(
      (n): n is typeof n & { guide_base_id: string } => n.guide_base_id !== null
    )
    .map((n) => n.guide_base_id);
  const baseMeta = new Map<
    string,
    { slug: string | null; title: string | null }
  >();

  if (baseIds.length > 0) {
    const { data: bases, error: baseError } = await supabase
      .from("guide_bases")
      .select(
        `id, slug,
         canonical:guides!guide_bases_canonical_guide_id_fkey(
           current:guide_revisions!guides_current_revision_id_fkey(title)
         )`
      )
      .in("id", baseIds);

    if (baseError) {
      console.error(baseError);
      throw new ServiceError("Failed to load revision", 500);
    }
    for (const b of bases ?? [])
      baseMeta.set(b.id, {
        slug: b.slug,
        title: b.canonical?.current?.title ?? null,
      });
  }

  const nodes = (nodeRows ?? []).map((n) => {
    const base = n.guide_base_id ? baseMeta.get(n.guide_base_id) : undefined;
    const isRequest = n.guide_base_id === null;

    return {
      id: n.id,
      guide_base_id: n.guide_base_id,
      guide_id: n.guide_id,
      slug: base?.slug ?? null,
      title: isRequest ? n.title : (base?.title ?? null),
      summary: isRequest ? n.summary : null,
      request_id: n.request_id,
      is_target: n.is_target,
      is_included: n.is_included,
      is_featured: n.is_featured,
      target_position: n.target_position,
      note: n.note,
    };
  });

  const { data: orderRows, error: orderError } = await supabase
    .from("objective_revision_node_orders")
    .select("target_node_id, node_id, position")
    .eq("revision_id", revisionId)
    .order("position");

  if (orderError) {
    console.error(orderError);
    throw new ServiceError("Failed to load revision order", 500);
  }

  // Two embeds of the same table need distinct aliases, or PostgREST names
  // them both once.
  const frozenQuery = supabase
    .from("objective_revision_edges")
    .select(
      `from:objective_revision_nodes!objective_revision_edges_from_is_node(guide_base_id),
       to:objective_revision_nodes!objective_revision_edges_to_is_node(guide_base_id)`
    )
    .eq("revision_id", revisionId);
  const projectedQuery =
    projectedSource === "live"
      ? supabase.rpc("project_objective_edges", { p_revision_id: revisionId })
      : frozenQuery;

  const [projected, raw, drawn] = await Promise.all([
    projectedQuery,
    baseIds.length > 0
      ? supabase
          .from("guide_edges")
          .select("from_guide_base_id, to_guide_base_id")
          .eq("edge_type", "prerequisite")
          .eq("is_suspended", false)
          .in("from_guide_base_id", baseIds)
          .in("to_guide_base_id", baseIds)
      : null,
    supabase
      .from("objective_revision_edges")
      .select("from_node_id, to_node_id")
      .eq("revision_id", revisionId),
  ]);

  if (projected.error) {
    console.error(projected.error);
    throw new ServiceError("Failed to load revision edges", 500);
  }
  if (raw?.error) {
    console.error(raw.error);
    throw new ServiceError("Failed to load revision edges", 500);
  }
  if (drawn.error) {
    console.error(drawn.error);
    throw new ServiceError("Failed to load revision edges", 500);
  }

  const toEdge = (e: {
    from_guide_base_id: string;
    to_guide_base_id: string;
  }) => ({
    from_id: e.from_guide_base_id,
    to_id: e.to_guide_base_id,
  });

  // frozen rows may touch a request node; those only make sense in drawn_edges
  const projected_edges = (projected.data ?? []).flatMap((e) => {
    if ("from_guide_base_id" in e) return [toEdge(e)];
    if (e.from.guide_base_id === null || e.to.guide_base_id === null) return [];
    return [{ from_id: e.from.guide_base_id, to_id: e.to.guide_base_id }];
  });
  const raw_edges = (raw?.data ?? []).map(toEdge);

  return {
    nodes,
    orders: orderRows ?? [],
    projected_edges,
    raw_edges,
    drawn_edges: drawn.data ?? [],
  };
}

export async function loadRevisionTags(supabase: DB, revisionId: string) {
  const { data, error } = await supabase
    .from("objective_revision_subjects")
    .select("subject:subjects(id, slug, name, summary, status)")
    .eq("objective_revision_id", revisionId);

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load revision subjects", 500);
  }
  return (data ?? []).map((r) => r.subject).filter((s) => s !== null);
}

// Replace a draft revision's subject tag set. Tags are keyed by subject id, not
// slug, because a subject proposed inline has no slug until it is approved.
export async function replaceRevisionTags(
  supabase: DB,
  revisionId: string,
  ids: string[]
) {
  const subjectIds = [...new Set(ids)];

  if (subjectIds.length > 0) {
    const { data, error } = await supabase
      .from("subjects")
      .select("id")
      .in("id", subjectIds);

    if (error) {
      console.error(error);
      throw new ServiceError("Failed to resolve subjects", 500);
    }
    if ((data ?? []).length !== subjectIds.length) {
      throw new ServiceError("Unknown subject tag", 400);
    }
  }

  const { error: delError } = await supabase
    .from("objective_revision_subjects")
    .delete()
    .eq("objective_revision_id", revisionId);

  if (delError) {
    console.error(delError);
    throw new ServiceError("Unable to update revision subjects", 400);
  }

  if (subjectIds.length > 0) {
    const { error: insError } = await supabase
      .from("objective_revision_subjects")
      .insert(
        subjectIds.map((subject_id) => ({
          objective_revision_id: revisionId,
          subject_id,
        }))
      );

    if (insError) {
      console.error(insError);
      throw new ServiceError("Unable to update revision subjects", 400);
    }
  }
}

export async function getObjectiveRevision(supabase: DB, revisionId: string) {
  const { data: row, error } = await supabase
    .from("objective_revisions")
    .select(
      `${REVISION_META}, objective:objectives!objective_revisions_objective_id_fkey(id, current_revision_id)`
    )
    .eq("id", revisionId)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load revision", 500);
  }
  if (!row) throw new ServiceError("Revision not found", 404);

  const { objective, ...revision } = row;

  const snapshot = await getRevisionSnapshot(
    supabase,
    revisionId,
    revision.status === "published" ? "frozen" : "live"
  );
  const subjects = await loadRevisionTags(supabase, revisionId);
  return { revision, objective, snapshot, subjects };
}

// Overwrite a draft revision's metadata and/or subject tags.
export async function updateObjectiveRevision(
  supabase: DB,
  userId: string,
  revisionId: string,
  input: UpdateObjectiveRevisionInput
) {
  const { tags, targets, graph, ...fields } = input;

  // Blank summary/change_summary are stored as NULL so a cleared field reads as
  // absent, matching the guide revision path.
  const patch = {
    ...fields,
    ...("summary" in fields && { summary: fields.summary || null }),
    ...("change_summary" in fields && {
      change_summary: fields.change_summary || null,
    }),
  };

  // Check if metadata changes are present.
  if (Object.keys(patch).length > 0) {
    const { data, error } = await supabase
      .from("objective_revisions")
      .update(patch)
      .eq("id", revisionId)
      .select(REVISION_META);

    if (error) throw new ServiceError("Unable to update revision", 400);
    if (!data || data.length === 0) {
      throw new ServiceError(
        "Revision not found or not an editable draft",
        404
      );
    }
  } else {
    const { data, error } = await supabase
      .from("objective_revisions")
      .select(REVISION_META)
      .eq("id", revisionId)
      .eq("status", "draft")
      .maybeSingle();

    if (error) {
      console.error(error);
      throw new ServiceError("Unable to update revision", 400);
    }
    if (!data) {
      throw new ServiceError(
        "Revision not found or not an editable draft",
        404
      );
    }
  }

  if (tags !== undefined) {
    await replaceRevisionTags(supabase, revisionId, tags);
  }
  // The graph decides which nodes exist and which are targets; curation then
  // orders and features those targets, so it has to read the saved graph.
  if (graph !== undefined) {
    await syncDraftGraph(supabase, userId, revisionId, graph);
  }
  if (targets !== undefined) {
    await syncDraftCuration(supabase, userId, revisionId, targets);
  }

  return getObjectiveRevision(supabase, revisionId);
}

// Edit one node of a draft revision: swap the pinned variant, skip it, or set a
// note. Whether it is a target is the graph's to say, in syncDraftGraph.
export async function updateObjectiveNode(
  supabase: DB,
  revisionId: string,
  baseId: string,
  input: UpdateObjectiveNodeInput
) {
  const { data, error } = await supabase
    .from("objective_revision_nodes")
    .update(input)
    .eq("revision_id", revisionId)
    .eq("guide_base_id", baseId)
    .select(NODE_COLS);

  if (error) throw new ServiceError("Unable to update node", 400);
  if (!data || data.length === 0) {
    throw new ServiceError("Node not found or not editable", 404);
  }
  const node = data[0];

  const { data: base, error: baseError } = await supabase
    .from("guide_bases")
    .select(
      `slug,
       canonical:guides!guide_bases_canonical_guide_id_fkey(
         current:guide_revisions!guides_current_revision_id_fkey(title)
       )`
    )
    .eq("id", baseId)
    .maybeSingle();

  if (baseError) {
    console.error(baseError);
    throw new ServiceError("Failed to load guide", 500);
  }

  return {
    node: {
      id: node.id,
      guide_base_id: node.guide_base_id,
      guide_id: node.guide_id,
      slug: base?.slug ?? null,
      title: base?.canonical?.current?.title ?? null,
      is_target: node.is_target,
      is_included: node.is_included,
      is_featured: node.is_featured,
      target_position: node.target_position,
      note: node.note,
    },
  };
}

async function loadClosure(supabase: DB, targetIds: string[]) {
  const { data, error } = await supabase.rpc("objective_closure", {
    p_targets: targetIds,
  });

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to resolve prerequisites", 500);
  }
  return (data ?? []).map((r) => r.guide_base_id);
}

export async function requireCurator(supabase: DB, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "curator");

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to verify permissions", 500);
  }
  if ((data ?? []).length === 0) {
    throw new ServiceError("Only curators can curate objectives", 403);
  }
}

// Order and feature the targets the graph derived, and place the topics under
// each. Which nodes exist and which are targets is not decided here.
export async function syncDraftCuration(
  supabase: DB,
  userId: string,
  revisionId: string,
  requested: ObjectiveTargetInput[]
) {
  await requireCurator(supabase, userId);

  const requestedIds = requested.map((t) => t.node_id);
  if (new Set(requestedIds).size !== requestedIds.length) {
    throw new ServiceError("Targets must be distinct", 400);
  }

  const { data: nodes, error: nodesError } = await supabase
    .from("objective_revision_nodes")
    .select("id, guide_base_id, is_target")
    .eq("revision_id", revisionId);

  if (nodesError) {
    console.error(nodesError);
    throw new ServiceError("Failed to load revision nodes", 500);
  }

  const nodeById = new Map((nodes ?? []).map((n) => [n.id, n]));
  // The client's target list is a guess made before the server derived; drift
  // is expected, garbage is not. A node that is no longer a target is dropped.
  if (requestedIds.some((id) => !nodeById.has(id))) {
    throw new ServiceError("Node is not a target of this revision", 400);
  }
  const targets = requested.filter((t) => nodeById.get(t.node_id)?.is_target);
  const targetIds = targets.map((t) => t.node_id);

  // A request target has no variant to publish yet; only a guide target needs one.
  const targetBases = targetIds
    .map((id) => nodeById.get(id)?.guide_base_id ?? null)
    .filter((id): id is string => id !== null);

  if (targetBases.length > 0) {
    const { data: bases, error: basesError } = await selectInBatches(
      targetBases,
      (batch) =>
        supabase
          .from("guide_bases")
          .select("id, canonical_guide_id")
          .in("id", batch)
    );

    if (basesError) {
      console.error(basesError);
      throw new ServiceError("Failed to load guides", 500);
    }

    const published = new Set(
      (bases ?? [])
        .filter((b) => b.canonical_guide_id !== null)
        .map((b) => b.id)
    );
    if (targetBases.some((id) => !published.has(id))) {
      throw new ServiceError("Target guide has no published variant", 400);
    }
  }

  // Clear first: position and featured are unique per revision, so a target
  // cannot take a slot another still holds.
  const { error: clearError } = await supabase
    .from("objective_revision_nodes")
    .update({ target_position: null, is_featured: false })
    .eq("revision_id", revisionId);

  if (clearError) {
    console.error(clearError);
    throw new ServiceError("Unable to update targets", 400);
  }

  const featuredIndex = targets.findIndex((t) => t.is_featured);
  for (const [i, t] of targets.entries()) {
    const { error } = await supabase
      .from("objective_revision_nodes")
      .update({
        is_included: true,
        target_position: i,
        is_featured: i === (featuredIndex === -1 ? 0 : featuredIndex),
      })
      .eq("revision_id", revisionId)
      .eq("id", t.node_id);

    if (error) {
      console.error(error);
      throw new ServiceError("Unable to update targets", 400);
    }
  }

  if (targets.every((t) => t.sequence === undefined)) return;

  const sequenced = new Set(targets.flatMap((t) => t.sequence ?? []));
  if ([...sequenced].some((id) => !nodeById.has(id))) {
    throw new ServiceError(
      "A node in the sequence is not in this objective's graph",
      400
    );
  }

  const included = (nodes ?? [])
    .filter((n) => n.is_target || sequenced.has(n.id))
    .map((n) => n.id);
  const excluded = (nodes ?? [])
    .filter((n) => !n.is_target && !sequenced.has(n.id))
    .map((n) => n.id);

  for (const [ids, value] of [
    [included, true],
    [excluded, false],
  ] as const) {
    if (ids.length === 0) continue;
    const { error } = await selectInBatches(ids, (batch) =>
      supabase
        .from("objective_revision_nodes")
        .update({ is_included: value })
        .eq("revision_id", revisionId)
        .in("id", batch)
    );
    if (error) {
      console.error(error);
      throw new ServiceError("Unable to update curation", 400);
    }
  }

  const { error: dropError } = await supabase
    .from("objective_revision_node_orders")
    .delete()
    .eq("revision_id", revisionId);

  if (dropError) {
    console.error(dropError);
    throw new ServiceError("Unable to update curation", 400);
  }

  const rows = targets.flatMap((t) =>
    (t.sequence ?? []).map((id, position) => ({
      revision_id: revisionId,
      target_node_id: t.node_id,
      node_id: id,
      position,
    }))
  );

  if (rows.length > 0) {
    const { error } = await supabase
      .from("objective_revision_node_orders")
      .insert(rows);

    if (error) {
      console.error(error);
      throw new ServiceError("Unable to update curation", 400);
    }
  }
}

type GraphNode = { id: string; guide_base_id: string | null };
type NodeEdge = { from_node_id: string; to_node_id: string };
type GuideEdge = { from_guide_base_id: string; to_guide_base_id: string };

// Prerequisite edges among the given guide bases, walked the same way as
// objective_closure: prerequisite -> dependent, suspended edges ignored.
async function loadGuideEdges(
  supabase: DB,
  baseIds: string[]
): Promise<GuideEdge[]> {
  const { data, error } = await selectInBatches(baseIds, (batch) =>
    supabase
      .from("guide_edges")
      .select("from_guide_base_id, to_guide_base_id")
      .eq("edge_type", "prerequisite")
      .eq("is_suspended", false)
      .in("from_guide_base_id", batch)
  );

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to resolve prerequisites", 500);
  }

  const bases = new Set(baseIds);
  return (data ?? []).filter((e) => bases.has(e.to_guide_base_id));
}

// A target is the end of a sub-objective: a node with no edge out to another
// node of the same set, drawn or between two of its guides. A request has no
// base, so only drawn edges can lead out of it.
function deriveTargets(
  nodes: GraphNode[],
  drawn: NodeEdge[],
  guideEdges: GuideEdge[]
): Set<string> {
  const ids = new Set(nodes.map((n) => n.id));
  const bases = new Set(
    nodes.map((n) => n.guide_base_id).filter((b): b is string => b !== null)
  );
  const leadsOn = new Set(
    drawn
      .filter((e) => ids.has(e.from_node_id) && ids.has(e.to_node_id))
      .map((e) => e.from_node_id)
  );
  const baseLeadsOn = new Set(
    guideEdges
      .filter(
        (e) => bases.has(e.from_guide_base_id) && bases.has(e.to_guide_base_id)
      )
      .map((e) => e.from_guide_base_id)
  );

  return new Set(
    nodes
      .filter(
        (n) =>
          !leadsOn.has(n.id) &&
          !(n.guide_base_id !== null && baseLeadsOn.has(n.guide_base_id))
      )
      .map((n) => n.id)
  );
}

// A node that stops being a target loses the curation hung on it: its position
// and featured flag (the checks require it) and the order rows it heads.
async function dropTargetCuration(
  supabase: DB,
  revisionId: string,
  nodeIds: string[]
) {
  if (nodeIds.length === 0) return;

  const { error: flagError } = await selectInBatches(nodeIds, (batch) =>
    supabase
      .from("objective_revision_nodes")
      .update({ is_target: false, target_position: null, is_featured: false })
      .eq("revision_id", revisionId)
      .in("id", batch)
  );
  if (flagError) {
    console.error(flagError);
    throw new ServiceError("Unable to update targets", 400);
  }

  const { error: orderError } = await selectInBatches(nodeIds, (batch) =>
    supabase
      .from("objective_revision_node_orders")
      .delete()
      .eq("revision_id", revisionId)
      .in("target_node_id", batch)
  );
  if (orderError) {
    console.error(orderError);
    throw new ServiceError("Unable to update curation", 400);
  }
}

// Replace a draft's node set and drawn edges with the graph the canvas sent,
// then derive which nodes are targets from it: the flags belong to the graph.
// Position, featured, inclusion, and notes are left to syncDraftCuration.
// ponytail: a run of statements, no transaction, like syncDraftCuration. A
// failed write leaves the save half done; the next save from the canvas repairs
// it. The way up is one RPC that does all of it.
export async function syncDraftGraph(
  supabase: DB,
  userId: string,
  revisionId: string,
  graph: ObjectiveGraphInput
) {
  await requireCurator(supabase, userId);

  const clientIds = new Set(graph.nodes.map((n) => n.id));
  if (clientIds.size !== graph.nodes.length) {
    throw new ServiceError("Graph nodes must be distinct", 400);
  }

  const dangling = graph.edges.some(
    (e) => !clientIds.has(e.from_node_id) || !clientIds.has(e.to_node_id)
  );
  if (dangling) {
    throw new ServiceError(
      "An edge names a node that is not in the graph",
      400
    );
  }

  const selfLoop = graph.edges.some((e) => e.from_node_id === e.to_node_id);
  if (selfLoop) {
    throw new ServiceError("A node cannot be its own prerequisite", 400);
  }

  const guideNodes = graph.nodes.filter((n) => "guide_base_id" in n);
  const requestNodes = graph.nodes.filter((n) => "title" in n);
  const baseIds = guideNodes.map((n) => n.guide_base_id);

  const { data: bases, error: basesError } = await selectInBatches(
    baseIds,
    (batch) =>
      supabase
        .from("guide_bases")
        .select("id, canonical_guide_id")
        .in("id", batch)
  );

  if (basesError) {
    console.error(basesError);
    throw new ServiceError("Failed to load guides", 500);
  }

  const canonicalByBase = new Map(
    (bases ?? [])
      .filter((b) => b.canonical_guide_id !== null)
      .map((b) => [b.id, b.canonical_guide_id as string])
  );

  if (baseIds.some((id) => !canonicalByBase.has(id))) {
    throw new ServiceError(
      "A guide in the graph has no published variant",
      400
    );
  }

  if (guideNodes.length > 0) {
    const { error } = await supabase.from("objective_revision_nodes").upsert(
      guideNodes.map((n) => ({
        id: n.id,
        revision_id: revisionId,
        guide_base_id: n.guide_base_id,
        guide_id: canonicalByBase.get(n.guide_base_id) as string,
      })),
      { onConflict: "revision_id, guide_base_id", ignoreDuplicates: true }
    );

    if (error) {
      console.error(error);
      throw new ServiceError("Unable to update graph", 400);
    }
  }

  if (requestNodes.length > 0) {
    const { error } = await supabase.from("objective_revision_nodes").upsert(
      requestNodes.map((n) => ({
        id: n.id,
        revision_id: revisionId,
        title: n.title,
        summary: n.summary ?? null,
      })),
      { onConflict: "id" }
    );

    if (error) {
      console.error(error);
      throw new ServiceError("Unable to update graph", 400);
    }
  }

  const { data: stored, error: storedError } = await supabase
    .from("objective_revision_nodes")
    .select("id, guide_base_id, is_target")
    .eq("revision_id", revisionId);

  if (storedError) {
    console.error(storedError);
    throw new ServiceError("Failed to load revision nodes", 500);
  }

  // A guide already on the draft keeps its stored id; a new one keeps the id
  // the canvas gave it.
  const storedIdByBase = new Map(
    (stored ?? [])
      .filter((n) => n.guide_base_id !== null)
      .map((n) => [n.guide_base_id as string, n.id])
  );
  const storedIdByClientId = new Map(
    graph.nodes.map((n) => [
      n.id,
      "guide_base_id" in n
        ? (storedIdByBase.get(n.guide_base_id) as string)
        : n.id,
    ])
  );
  const kept = new Set(storedIdByClientId.values());
  const drawn = graph.edges.map((e) => ({
    from_node_id: storedIdByClientId.get(e.from_node_id) as string,
    to_node_id: storedIdByClientId.get(e.to_node_id) as string,
  }));
  const guideEdges = await loadGuideEdges(supabase, [...storedIdByBase.keys()]);

  // The canvas may not hold every prerequisite of its targets (a draft seeded
  // before the graph owned membership), so don't let it delete them.
  const graphTargets = deriveTargets(
    (stored ?? []).filter((n) => kept.has(n.id)),
    drawn,
    guideEdges
  );
  const targetBases = (stored ?? [])
    .filter((n) => graphTargets.has(n.id) && n.guide_base_id !== null)
    .map((n) => n.guide_base_id as string);
  const closure = new Set(
    targetBases.length > 0 ? await loadClosure(supabase, targetBases) : []
  );
  const removed = (stored ?? [])
    .filter(
      (n) =>
        !kept.has(n.id) &&
        !(n.guide_base_id !== null && closure.has(n.guide_base_id))
    )
    .map((n) => n.id);

  if (removed.length > 0) {
    const { error } = await selectInBatches(removed, (batch) =>
      supabase
        .from("objective_revision_nodes")
        .delete()
        .eq("revision_id", revisionId)
        .in("id", batch)
    );

    if (error) {
      console.error(error);
      throw new ServiceError("Unable to update graph", 400);
    }
  }

  const { error: dropError } = await supabase
    .from("objective_revision_edges")
    .delete()
    .eq("revision_id", revisionId);

  if (dropError) {
    console.error(dropError);
    throw new ServiceError("Unable to update graph", 400);
  }

  if (drawn.length > 0) {
    const { error } = await supabase
      .from("objective_revision_edges")
      .insert(drawn.map((e) => ({ revision_id: revisionId, ...e })));

    if (error) {
      console.error(error);
      throw new ServiceError("Unable to update graph", 400);
    }
  }

  // Derive over what the revision holds now, the protected prerequisites too.
  const gone = new Set(removed);
  const remaining = (stored ?? []).filter((n) => !gone.has(n.id));
  const targets = deriveTargets(remaining, drawn, guideEdges);

  await dropTargetCuration(
    supabase,
    revisionId,
    remaining.filter((n) => n.is_target && !targets.has(n.id)).map((n) => n.id)
  );

  const becomeTargets = remaining
    .filter((n) => !n.is_target && targets.has(n.id))
    .map((n) => n.id);
  if (becomeTargets.length > 0) {
    const { error } = await selectInBatches(becomeTargets, (batch) =>
      supabase
        .from("objective_revision_nodes")
        .update({ is_target: true })
        .eq("revision_id", revisionId)
        .in("id", batch)
    );

    if (error) {
      console.error(error);
      throw new ServiceError("Unable to update targets", 400);
    }
  }
}

// Publish the draft directly (no review gate): freeze its edge projection, point
// the objective at it, and freeze the slug on first publish in one transaction via the
// publish_objective_revision RPC. Returns the live slug for routing.
export async function publishObjectiveRevision(
  supabase: DB,
  revisionId: string
) {
  const { data: slug, error } = await supabase.rpc(
    "publish_objective_revision",
    {
      p_revision_id: revisionId,
    }
  );

  if (error) {
    if (error.code === "P0002")
      throw new ServiceError("Revision not found", 404);
    if (error.code === "42501")
      throw new ServiceError("Not permitted to publish this revision", 403);
    if (error.code === "40001")
      throw new ServiceError(
        "A newer revision was published; review it before publishing",
        409
      );
    if (error.code === "P0001")
      throw new ServiceError("This would create a cycle", 409);
    throw new ServiceError("Unable to publish revision", 400);
  }
  return { slug };
}

// Roll an older revision forward as a new draft: clone its nodes, orders and
// drawn edges into a fresh draft on the same objective in one transaction via
// the rollback_objective_revision RPC. Returns the draft revision id, so the
// client routes to its editor.
export async function rollbackObjectiveRevision(
  supabase: DB,
  revisionId: string,
  sourceRevisionId: string
) {
  const { data: revision_id, error } = await supabase.rpc(
    "rollback_objective_revision",
    {
      p_revision_id: revisionId,
      p_source_revision_id: sourceRevisionId,
    }
  );

  if (error) {
    if (error.code === "P0002")
      throw new ServiceError("Revision not found for this objective", 404);
    if (error.code === "42501")
      throw new ServiceError("Not permitted to roll back this revision", 403);
    throw new ServiceError("Unable to roll back revision", 400);
  }

  return { revision_id };
}

// One node from getRevisionSnapshot, as it appears in a sub-objective's
// sequence.
type SnapshotNode = {
  id: string;
  guide_base_id: string | null;
  guide_id: string | null;
  slug: string | null;
  title: string | null;
  summary: string | null;
  request_id: string | null;
  is_target: boolean;
  is_included: boolean;
  is_featured: boolean;
  target_position: number | null;
  note: string | null;
};

export async function diffObjectiveRevisions(
  supabase: DB,
  id: string,
  otherId: string
) {
  const [fromRes, toRes] = await Promise.all([
    supabase
      .from("objective_revisions")
      .select(DIFF_REVISION_META)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("objective_revisions")
      .select(DIFF_REVISION_META)
      .eq("id", otherId)
      .maybeSingle(),
  ]);

  if (fromRes.error) {
    console.error(fromRes.error);
    throw new ServiceError("Failed to load revision", 500);
  }
  if (toRes.error) {
    console.error(toRes.error);
    throw new ServiceError("Failed to load revision", 500);
  }
  if (!fromRes.data) throw new ServiceError("Revision not found", 404);
  if (!toRes.data) throw new ServiceError("Revision not found", 404);

  const from = fromRes.data;
  const to = toRes.data;

  const [fromSnapshot, toSnapshot] = await Promise.all([
    getRevisionSnapshot(
      supabase,
      id,
      from.status === "published" ? "frozen" : "live"
    ),
    getRevisionSnapshot(
      supabase,
      otherId,
      to.status === "published" ? "frozen" : "live"
    ),
  ]);

  return {
    from: toRevisionRef(from),
    to: toRevisionRef(to),
    fields: {
      title: diffField(from.title, to.title),
      summary: diffField(from.summary, to.summary),
    },
    targets: diffTargets(fromSnapshot, toSnapshot),
  };
}

// Two nodes paired by diffKey are "the same" iff every per-revision column
// matches. slug/title are excluded: both snapshots read them live from the
// current guide_bases row, so a paired guide always agrees on them and they
// can never signal a change. id is excluded too: it is a per-revision surrogate,
// so paired guides never share one.
function sameNode(
  a: {
    guide_id: string | null;
    is_target: boolean;
    is_included: boolean;
    is_featured: boolean;
    target_position: number | null;
    note: string | null;
  },
  b: {
    guide_id: string | null;
    is_target: boolean;
    is_included: boolean;
    is_featured: boolean;
    target_position: number | null;
    note: string | null;
  }
): boolean {
  return (
    a.guide_id === b.guide_id &&
    a.is_target === b.is_target &&
    a.is_included === b.is_included &&
    a.is_featured === b.is_featured &&
    a.target_position === b.target_position &&
    a.note === b.note
  );
}

type SnapshotOrder = {
  target_node_id: string;
  node_id: string;
  position: number;
};

type SubObjective = { target: SnapshotNode; steps: SnapshotNode[] };

function buildSubObjectives(snapshot: {
  nodes: SnapshotNode[];
  orders: SnapshotOrder[];
}): SubObjective[] {
  const nodeById = new Map(snapshot.nodes.map((n) => [n.id, n]));

  return snapshot.nodes
    .filter((n) => n.is_target)
    .sort((a, b) => (a.target_position ?? 0) - (b.target_position ?? 0))
    .map((target) => ({
      target,
      steps: [
        ...snapshot.orders
          .filter((o) => o.target_node_id === target.id)
          .sort((a, b) => a.position - b.position)
          .map((o) => nodeById.get(o.node_id))
          .filter((n): n is SnapshotNode => n !== undefined),
        target,
      ],
    }));
}

function stepLabel(node: SnapshotNode) {
  const label =
    node.title ?? node.slug ?? node.guide_base_id?.slice(0, 8) ?? "";
  return node.is_included ? label : `${label} (skipped)`;
}

// Node ids are per-revision surrogates, so a guide pairs across the two
// revisions by its base. A request node has no base and pairs only by its id.
function diffKey(node: SnapshotNode) {
  return node.guide_base_id ?? node.id;
}

// Per sub-objective view of the diff.
function diffTargets(
  fromSnapshot: { nodes: SnapshotNode[]; orders: SnapshotOrder[] },
  toSnapshot: { nodes: SnapshotNode[]; orders: SnapshotOrder[] }
) {
  const fromSequences = new Map(
    buildSubObjectives(fromSnapshot).map((s) => [diffKey(s.target), s])
  );
  const toSequences = buildSubObjectives(toSnapshot);
  const seen = new Set<string>();

  const build = (
    target: SnapshotNode,
    fromSteps: SnapshotNode[],
    toSteps: SnapshotNode[],
    status: "added" | "removed" | "changed" | "unchanged"
  ) => {
    const lines = diffSequences(fromSteps, toSteps, diffKey, stepLabel);
    const fromByKey = new Map(fromSteps.map((s) => [diffKey(s), s]));

    const changed = toSteps
      .map((step) => {
        const before = fromByKey.get(diffKey(step));
        if (!before || sameNode(before, step)) return null;
        return { from: before, to: step };
      })
      .filter((c) => c !== null);

    const sequenceChanged = lines.some((l) => l.type !== "unchanged");

    return {
      guide_base_id: target.guide_base_id,
      slug: target.slug,
      title: target.title,
      status:
        status === "changed" && !sequenceChanged && changed.length === 0
          ? ("unchanged" as const)
          : status,
      lines,
      changed,
    };
  };

  const targets = toSequences.map((sequence) => {
    const key = diffKey(sequence.target);
    seen.add(key);
    const before = fromSequences.get(key);

    return build(
      sequence.target,
      before?.steps ?? [],
      sequence.steps,
      before ? "changed" : "added"
    );
  });

  for (const [key, sequence] of fromSequences) {
    if (seen.has(key)) continue;
    targets.push(build(sequence.target, sequence.steps, [], "removed"));
  }

  return targets;
}

// Project a revision row down to the RevisionRef shape used in diff headers.
function toRevisionRef(row: {
  id: string;
  author_id: string | null;
  created_at: string;
  change_summary: string | null;
}) {
  return {
    id: row.id,
    author_id: row.author_id,
    created_at: row.created_at,
    change_summary: row.change_summary,
  };
}
