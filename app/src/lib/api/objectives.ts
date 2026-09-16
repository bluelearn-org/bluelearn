import type { InferRequestType } from "hono/client";
import { client } from "@/lib/api/apiClient";
import { assertOk } from "@/lib/api/apiHelpers";

const objectives = client.objectives;

type FetchOptions = { signal?: AbortSignal };

export async function listObjectives(
  { page = 1, limit = 20 }: { page?: number; limit?: number } = {},
  { signal }: FetchOptions = {}
) {
  const res = await objectives.$get(
    { query: { page: String(page), limit: String(limit) } },
    { init: { signal } }
  );
  if (!res.ok) return assertOk(res) as Promise<never>;

  return res.json();
}

export async function getObjective(
  slug: string,
  { signal }: FetchOptions = {}
) {
  const res = await objectives[":slug"].$get(
    { param: { slug } },
    { init: { signal } }
  );
  if (!res.ok) return assertOk(res) as Promise<never>;

  return res.json();
}

export async function listObjectiveRevisions(
  slug: string,
  { page = 1, limit = 20 }: { page?: number; limit?: number } = {},
  { signal }: FetchOptions = {}
) {
  const res = await objectives[":slug"].revisions.$get(
    { param: { slug }, query: { page: String(page), limit: String(limit) } },
    { init: { signal } }
  );
  if (!res.ok) return assertOk(res) as Promise<never>;

  return res.json();
}

export async function getObjectiveContributors(
  slug: string,
  { signal }: FetchOptions = {}
) {
  const res = await objectives[":slug"].contributors.$get(
    { param: { slug } },
    { init: { signal } }
  );
  if (!res.ok) return assertOk(res) as Promise<never>;

  return res.json();
}

export async function createObjective(
  body: InferRequestType<typeof objectives.$post>["json"]
) {
  const res = await objectives.$post({ json: body });
  await assertOk(res);

  const { revision_id } = await res.json();
  return revision_id;
}

export async function createObjectiveRevision(slug: string) {
  const res = await objectives[":slug"].revisions.$post({ param: { slug } });
  await assertOk(res);

  const { revision_id } = await res.json();
  return revision_id;
}
