import { client } from "@/lib/api/apiClient";
import { assertOk } from "@/lib/api/apiHelpers";

const reviews = client.reviews;

type FetchOptions = { signal?: AbortSignal };

export async function listReviewCases({ signal }: FetchOptions = {}) {
  const res = await reviews.queue.$get(undefined, { init: { signal } });
  await assertOk(res);

  const { cases } = await res.json();
  return cases;
}

export async function getReviewCase(id: string, { signal }: FetchOptions = {}) {
  const res = await reviews.cases[":id"].$get(
    { param: { id } },
    { init: { signal } }
  );
  await assertOk(res);

  return await res.json();
}
