import { client } from "@/lib/api/apiClient";
import { assertOk } from "@/lib/api/apiHelpers";

const variants = client.variants;
const guides = client.guides;

type FetchOptions = { signal?: AbortSignal };

// Resolves a base + variant slug pair to the variant, whose id keys the
// id-based /variants routes.
export async function getVariantBySlug(
  slug: string,
  variantSlug: string,
  { signal, mature }: FetchOptions & { mature?: "confirmed" } = {}
) {
  const res = await guides[":slug"][":variantSlug"].$get(
    { param: { slug, variantSlug }, query: { mature } },
    { init: { signal } }
  );
  await assertOk(res);

  const { variant } = await res.json();
  return variant;
}

export async function getVariant(id: string, { signal }: FetchOptions = {}) {
  const res = await variants[":id"].$get(
    { param: { id } },
    { init: { signal } }
  );
  await assertOk(res);

  const { variant } = await res.json();
  return variant;
}

export async function getVariantContributors(
  id: string,
  { signal }: FetchOptions = {}
) {
  const res = await variants[":id"].contributors.$get(
    { param: { id } },
    { init: { signal } }
  );
  await assertOk(res);

  return res.json();
}

export async function getVariantRevisions(
  id: string,
  { signal }: FetchOptions = {}
) {
  const res = await variants[":id"].revisions.$get(
    { param: { id }, query: { page: "1", limit: "100" } },
    { init: { signal } }
  );
  if (!res.ok) return assertOk(res) as Promise<never>;

  return res.json();
}

// Opens a draft revision seeded from the variant's live content. 409 if the
// variant has never published.
export async function createVariantRevision(id: string) {
  const res = await variants[":id"].revisions.$post({ param: { id } });
  await assertOk(res);

  const { revision_id } = await res.json();
  return revision_id;
}
