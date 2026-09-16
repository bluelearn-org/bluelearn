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

export async function getGuide(slug: string, { signal }: FetchOptions = {}) {
  const res = await guides[":slug"].$get(
    { param: { slug } },
    { init: { signal } }
  );
  if (!res.ok) return assertOk(res) as Promise<never>;

  return res.json();
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
  await assertOk(res);

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
  await assertOk(res);

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
