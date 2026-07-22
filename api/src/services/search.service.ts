import type { SupabaseClient } from "@supabase/supabase-js";
import type { Context } from "hono";
import type {
  GuideListItem,
  ObjectiveListItem,
  SearchQueryInput,
} from "@bluelearn/schemas";
import type { Database } from "../database.types";
// .ts extension so scripts/typesense-sync.ts stays runnable under plain
// `node --experimental-strip-types` (extensionless relative imports fail there).
import { ServiceError } from "../lib/service-error";
import { buildGuideListItems } from "./guide.service";
import { buildObjectiveListItems } from "./objective.service";
import type { Bindings, HonoEnv } from "../types";

type DB = SupabaseClient<Database>;

export const GUIDES_COLLECTION = "guides";
export const OBJECTIVES_COLLECTION = "objectives";

// Card rows accepted by buildGuideListItems/buildObjectiveListItems — inferred
// rather than redeclared so search.service.ts can't drift from those shapes.
type GuideRow = Parameters<typeof buildGuideListItems>[1][number];
type ObjectiveRow = Parameters<typeof buildObjectiveListItems>[1][number];

// Indexed guide document, same shape the /guides list endpoint returns.
export const guidesCollectionSchema = {
  name: GUIDES_COLLECTION,
  enable_nested_fields: true,
  fields: [
    { name: "slug", type: "string" },
    { name: "title", type: "string" },
    { name: "knowledge_type", type: "string", facet: true },
    { name: "status", type: "string", facet: true },
    { name: "created_at", type: "string" },
    { name: "summary", type: "string", optional: true },
    { name: "author", type: "string", optional: true },
    { name: "duration_minutes", type: "int32" },
    { name: "tags", type: "object[]", optional: true, facet: true },
  ],
} as const;

// Indexed objective document, same shape the /objectives list endpoint
// returns.
export const objectivesCollectionSchema = {
  name: OBJECTIVES_COLLECTION,
  enable_nested_fields: true,
  fields: [
    { name: "slug", type: "string" },
    { name: "title", type: "string" },
    { name: "summary", type: "string", optional: true },
    { name: "curator", type: "string", optional: true },
    { name: "created_at", type: "string" },
    { name: "guides_total", type: "int32" },
    { name: "duration_minutes", type: "int32" },
    { name: "featured_sub_objective", type: "object[]", optional: true },
  ],
} as const;

export type SearchDocument = GuideListItem | ObjectiveListItem;

// Typesense rejects explicit nulls on optional fields; GuideListItem/
// ObjectiveListItem carry them for nullable columns, so drop null keys
// before indexing.
export function stripNulls<T extends object>(item: T): T {
  const doc = {} as T;
  for (const [key, value] of Object.entries(item)) {
    if (value !== null && value !== undefined)
      (doc as Record<string, unknown>)[key] = value;
  }
  return doc;
}

// Same select listPublishedGuides uses, so buildGuideListItems (author,
// knowledge_type, tags, duration_minutes) can be reused as-is.
export const SEARCH_DOC_SELECT =
  `id, slug, title, knowledge_type, status, created_at,
  canonical:guides!guide_bases_canonical_guide_id_fkey!inner(
    author_id,
    current:guide_revisions!guides_current_revision_id_fkey!inner(
      id, summary, word_count
    )
  )` as const;

// Map a SEARCH_DOC_SELECT row to its Typesense document. Returns null for
// rows missing slug/title (nullable in the generated types, never null for
// published guides) — skip those rather than indexing them.
export async function rowToGuideDocument(
  supabase: DB,
  row: GuideRow
): Promise<GuideListItem | null> {
  if (!row.slug || !row.title) return null;
  const [item] = await buildGuideListItems(supabase, [row]);
  return stripNulls(item);
}

// Same select listPublishedObjectives uses, so buildObjectiveListItems
// (curator, guides_total, duration_minutes, featured_sub_objective) can be
// reused as-is.
export const OBJECTIVE_DOC_SELECT =
  `id, slug, created_by, created_at, current_revision_id, status,
  current:objective_revisions!objectives_current_revision_id_fkey(
    title,
    summary
  )` as const;

export async function rowToObjectiveDocument(
  supabase: DB,
  row: ObjectiveRow
): Promise<ObjectiveListItem | null> {
  if (!row.slug || !row.current?.title) return null;
  const [item] = await buildObjectiveListItems(supabase, [row]);
  return stripNulls(item);
}

function typesenseFetch(env: Bindings, path: string, init?: RequestInit) {
  const baseUrl = `${env.TYPESENSE_PROTOCOL}://${env.TYPESENSE_HOST}:${env.TYPESENSE_PORT}`;
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "X-TYPESENSE-API-KEY": env.TYPESENSE_API_KEY,
      "Content-Type": "application/json",
    },
  });
}

// Registry of searchable collections. Adding a new index = one entry here
// (plus a backfill in scripts/typesense-sync.ts): the /search endpoint,
// validation, and multi-search fan-out pick it up automatically.
const SEARCH_COLLECTIONS: Record<string, { queryBy: string }> = {
  // Order is the relevance weighting: title > tags > summary.
  [GUIDES_COLLECTION]: { queryBy: "title,tags.name,summary" },
  [OBJECTIVES_COLLECTION]: { queryBy: "title,summary" },
};

// One collection's slice of a multi_search response. Typesense returns either
// a search result or an { error, code } object per collection.
type TypesenseSearchResult = {
  found: number;
  page: number;
  facet_counts?: unknown[];
  hits?: {
    document: Record<string, unknown>;
    // `highlight` is Typesense's legacy per-field format and can't point at
    // which element of an array field (e.g. tags) matched; `highlights` is
    // the newer array format with explicit `field`/`indices` and is what
    // Typesense recommends for new integrations, so it's the one we keep.
    // `text_match` loses precision above Number.MAX_SAFE_INTEGER
    // (text_match_info.score carries the same value as a string, unaffected)
    // and nothing here consumes relevance scores, so both are dropped.
    highlight?: unknown;
    highlights?: unknown;
    text_match?: unknown;
    text_match_info?: unknown;
  }[];
  error?: string;
  code?: number;
};

// Fan a query out over one or more collections via POST /multi_search,
// passing filter_by/sort_by/facet_by through untouched so the endpoint keeps
// up with Typesense features instead of allowlisting them one by one. The
// expressions apply to every requested collection, so callers should only
// combine collections with the fields they filter/sort on.
export async function searchCollections(
  env: Bindings,
  input: SearchQueryInput
) {
  const unknown = input.collections.filter((c) => !SEARCH_COLLECTIONS[c]);
  if (unknown.length > 0)
    throw new ServiceError(`Unknown collection: ${unknown.join(", ")}`, 400);

  const searches = input.collections.map((collection) => ({
    collection,
    q: input.q,
    query_by: SEARCH_COLLECTIONS[collection].queryBy,
    page: input.page,
    per_page: input.per_page,
    ...(input.filter_by && { filter_by: input.filter_by }),
    ...(input.sort_by && { sort_by: input.sort_by }),
    ...(input.facet_by && { facet_by: input.facet_by }),
  }));

  let res: Response;
  try {
    res = await typesenseFetch(env, "/multi_search", {
      method: "POST",
      body: JSON.stringify({ searches }),
    });
  } catch (error) {
    console.error(error);
    throw new ServiceError("Search is unavailable", 503);
  }
  if (!res.ok) {
    console.error(`Typesense responded ${res.status}: ${await res.text()}`);
    throw new ServiceError("Search failed", 500);
  }

  const body = (await res.json()) as { results: TypesenseSearchResult[] };

  // multi_search reports failures per collection, not via the HTTP status.
  const results: Record<
    string,
    Pick<TypesenseSearchResult, "found" | "page" | "facet_counts" | "hits">
  > = {};
  input.collections.forEach((collection, i) => {
    const result = body.results[i];
    if (result.error) {
      // Missing collection = nothing indexed yet; treat as no results rather
      // than surfacing an infrastructure detail. Anything else (bad filter_by
      // etc.) is the caller's query, so tell them.
      if (result.code === 404) {
        results[collection] = { found: 0, page: input.page, hits: [] };
        return;
      }
      throw new ServiceError(`${collection}: ${result.error}`, 400);
    }
    results[collection] = {
      found: result.found,
      page: result.page,
      hits: (result.hits ?? []).map((hit) => ({
        document: hit.document,
        highlights: hit.highlights,
      })),
      ...(result.facet_counts?.length && { facet_counts: result.facet_counts }),
    };
  });
  return results;
}

// Upsert the document, or delete by id when doc is null (unpublished).
async function pushDocument(
  env: Bindings,
  collection: string,
  id: string,
  doc: SearchDocument | null
) {
  if (doc) {
    const res = await typesenseFetch(
      env,
      `/collections/${collection}/documents?action=upsert`,
      { method: "POST", body: JSON.stringify(doc) }
    );
    if (!res.ok)
      throw new Error(`upsert failed: ${res.status} ${await res.text()}`);
  } else {
    const res = await typesenseFetch(
      env,
      `/collections/${collection}/documents/${id}`,
      { method: "DELETE" }
    );
    // 404 = never indexed (or collection missing) — already the desired state.
    if (!res.ok && res.status !== 404)
      throw new Error(`delete failed: ${res.status} ${await res.text()}`);
  }
}

// Bring one guide's Typesense document in line with its DB state: upsert when
// published, delete otherwise. Best-effort — a stale index must never fail
// the request (log and move on); scripts/typesense-sync.ts --force repairs
// any drift. RLS hides unpublished bases from most callers, so an invisible
// row also reads as "not published" and falls through to delete.
export async function syncGuideDocument(
  env: Bindings,
  supabase: DB,
  guideBaseId: string
) {
  try {
    const { data, error } = await supabase
      .from("guide_bases")
      .select(SEARCH_DOC_SELECT)
      .eq("id", guideBaseId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const doc =
      data?.status === "published"
        ? await rowToGuideDocument(supabase, data)
        : null;
    await pushDocument(env, GUIDES_COLLECTION, guideBaseId, doc);
  } catch (error) {
    console.error(`Search sync failed for guide ${guideBaseId}:`, error);
  }
}

// Same contract as syncGuideDocument, for one objective.
export async function syncObjectiveDocument(
  env: Bindings,
  supabase: DB,
  objectiveId: string
) {
  try {
    const { data, error } = await supabase
      .from("objectives")
      .select(OBJECTIVE_DOC_SELECT)
      .eq("id", objectiveId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const doc =
      data?.status === "published"
        ? await rowToObjectiveDocument(supabase, data)
        : null;
    await pushDocument(env, OBJECTIVES_COLLECTION, objectiveId, doc);
  } catch (error) {
    console.error(`Search sync failed for objective ${objectiveId}:`, error);
  }
}

// Publishing an objective goes through its revision id; resolve it to the
// objective and re-sync. Best-effort, same as the document syncs.
export async function syncObjectiveForRevision(
  env: Bindings,
  supabase: DB,
  revisionId: string
) {
  try {
    const { data, error } = await supabase
      .from("objective_revisions")
      .select("objective_id")
      .eq("id", revisionId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (data) await syncObjectiveDocument(env, supabase, data.objective_id);
  } catch (error) {
    console.error(`Search sync failed for revision ${revisionId}:`, error);
  }
}

// A deciding review vote may have just published the case's revision; re-sync
// the guide it belongs to. Non-guide cases have no guide_review_cases row and
// no-op. Best-effort, same as syncGuideDocument.
export async function syncGuideForReviewCase(
  env: Bindings,
  supabase: DB,
  caseId: string
) {
  try {
    const { data, error } = await supabase
      .from("guide_review_cases")
      .select(
        `revision:guide_revisions!guide_review_cases_guide_revision_id_fkey(
          guide:guides!guide_revisions_guide_id_fkey(guide_base_id)
        )`
      )
      .eq("case_id", caseId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const baseId = data?.revision?.guide?.guide_base_id;
    if (baseId) await syncGuideDocument(env, supabase, baseId);
  } catch (error) {
    console.error(`Search sync failed for review case ${caseId}:`, error);
  }
}

// waitUntil keeps the sync running past the response on Workers. Tests call
// app.request() without an execution context, where accessing it throws — the
// task is already running detached, so just let it finish on its own.
export function scheduleSearchSync(c: Context<HonoEnv>, task: Promise<void>) {
  try {
    c.executionCtx.waitUntil(task);
  } catch {
    // no execution context (tests)
  }
}
