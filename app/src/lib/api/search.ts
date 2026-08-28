import type { GuideListItem, ObjectiveListItem } from "@bluelearn/schemas";

import { client } from "@/lib/api/apiClient";
import { assertOk } from "@/lib/api/apiHelpers";

type FetchOptions = { signal?: AbortSignal };

export type Collection = "guides" | "objectives";
export type KnowledgeType = "theoretical" | "practical";

// The filter selection the UI carries in state / the URL. `scope` narrows the
// collections; `knowledgeType` is a guide-only facet, so it only takes effect
// when scope is "guides" (objectives have no such field and Typesense would
// reject the filter_by on that collection).
export type SearchFilters = {
  scope?: Collection;
  knowledgeType?: KnowledgeType;
};

// Translate UI filters into the collections + filter_by the endpoint expects.
export function filtersToParams(
  filters: SearchFilters
): Pick<SearchParams, "collections" | "filter_by"> {
  const collections: Array<Collection> = filters.scope
    ? [filters.scope]
    : ["guides", "objectives"];
  const filter_by =
    filters.scope === "guides" && filters.knowledgeType
      ? `knowledge_type:=${filters.knowledgeType}`
      : undefined;
  return { collections, ...(filter_by ? { filter_by } : {}) };
}

export type SearchParams = {
  q: string;
  // Which indexes to search. Defaults to both.
  collections?: Array<Collection>;
  page?: number;
  per_page?: number;
  filter_by?: string;
};

// Typesense hits come back as Record<string, unknown>; the indexed documents
// are exactly GuideListItem/ObjectiveListItem, so cast per collection.
function hitsOf<T>(collection?: {
  found: number;
  hits?: Array<{ document: Record<string, unknown> }>;
}) {
  return {
    found: collection?.found ?? 0,
    items: (collection?.hits ?? []).map((h) => h.document as T),
  };
}

export async function search(
  {
    q,
    collections = ["guides", "objectives"],
    page = 1,
    per_page = 10,
    filter_by,
  }: SearchParams,
  { signal }: FetchOptions = {}
) {
  const res = await client.search.$get(
    {
      query: {
        q,
        collections: collections.join(","),
        page: String(page),
        per_page: String(per_page),
        ...(filter_by ? { filter_by } : {}),
      },
    },
    { init: { signal } }
  );
  await assertOk(res);

  const { results } = await res.json();
  return {
    guides: hitsOf<GuideListItem>(results.guides),
    objectives: hitsOf<ObjectiveListItem>(results.objectives),
  };
}
