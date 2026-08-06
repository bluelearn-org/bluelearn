import type { InferRequestType } from "hono/client";
import type { GuideListItem } from "@bluelearn/schemas";
import { client } from "@/lib/api/apiClient";
import { assertOk, collectAll } from "@/lib/api/apiHelpers";

const guides = client.guides;

type FetchOptions = { signal?: AbortSignal };

export async function listGuides({ signal }: FetchOptions = {}) {
  return collectAll<GuideListItem>(async (query) => {
    const res = await guides.$get({ query }, { init: { signal } });
    if (!res.ok) return assertOk(res) as Promise<never>;

    const { guides: items, total } = await res.json();
    return { items, total };
  });
}

export async function listGuidesPage(
  { page = 1, limit = 20 }: { page?: number; limit?: number } = {},
  { signal }: FetchOptions = {}
) {
  const res = await guides.$get(
    { query: { page: String(page), limit: String(limit) } },
    { init: { signal } }
  );
  if (!res.ok) return assertOk(res) as Promise<never>;

  return res.json();
}

export async function getGuide(
  slug: string,
  options: { variant?: string } & FetchOptions = {}
) {
  const { variant, signal } = options;
  const res = await guides[":slug"].$get(
    {
      param: { slug },
      query: variant ? { variant } : {},
    },
    { init: { signal } }
  );
  if (!res.ok) return assertOk(res) as Promise<never>;

  return res.json();
}

export async function getVariantId(slug: string) {
  // Return the id for the variant, given a slug

  const guide = await getGuide(slug);
  const mainSlug = guide.slug;
  const variantSlug = guide.variant_slug;

  // Get variant id through its slug
  const api = import.meta.env.VITE_API_BASE;

  const variantsRes = await fetch(`${api}/guides/${mainSlug}/${variantSlug}`);
  const variants = await variantsRes.json();
  const variant = variants.variant;

  return variant.id;
}

export async function getGuideWalkthrough(
  slug: string,
  { signal }: FetchOptions = {}
) {
  const res = await guides[":slug"].walkthrough.$get(
    { param: { slug } },
    { init: { signal } }
  );
  if (!res.ok) return assertOk(res) as Promise<never>;

  return res.json();
}

export async function createGuide(
  body: InferRequestType<typeof guides.$post>["json"]
) {
  const res = await guides.$post({ json: body });
  if (!res.ok) return assertOk(res) as Promise<never>;

  const { revision_id } = await res.json();
  return revision_id;
}

export async function addGuideVariant(
  slug: string,
  body: InferRequestType<(typeof guides)[":slug"]["variants"]["$post"]>["json"]
) {
  const res = await guides[":slug"].variants.$post({
    param: { slug },
    json: body,
  });
  if (!res.ok) return assertOk(res) as Promise<never>;

  const { revision_id } = await res.json();
  return revision_id;
}

export async function getGuideVariants(
  slug: string,
  { signal }: FetchOptions = {}
) {
  const res = await guides[":slug"].variants.$get(
    { param: { slug }, query: { page: "1", limit: "100" } },
    { init: { signal } }
  );
  if (!res.ok) return assertOk(res) as Promise<never>;

  return res.json();
}

export async function getGuideObjectives(
  slug: string,
  { signal }: FetchOptions = {}
) {
  const res = await guides[":slug"].objectives.$get(
    { param: { slug } },
    { init: { signal } }
  );
  if (!res.ok) return assertOk(res) as Promise<never>;

  return res.json();
}

export async function getGuideContributors(
  slug: string,
  { signal }: FetchOptions = {}
) {
  const res = await guides[":slug"].contributors.$get(
    { param: { slug } },
    { init: { signal } }
  );
  if (!res.ok) return assertOk(res) as Promise<never>;

  return res.json();
}

export async function getGuideRevisions(
  slug: string,
  { signal }: FetchOptions = {}
) {
  const res = await guides[":slug"].revisions.$get(
    { param: { slug }, query: { page: "1", limit: "100" } },
    { init: { signal } }
  );
  if (!res.ok) return assertOk(res) as Promise<never>;

  return res.json();
}
