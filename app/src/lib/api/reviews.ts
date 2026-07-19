import { client } from "@/lib/api/apiClient";

const reviews = client.reviews;

type FetchOptions = { signal?: AbortSignal };

// The API answers failures with `{ error: string }`; surface that message so
// callers can render it, and fall back to the status when the body isn't JSON.
async function assertOk(res: Response) {
  if (res.ok) return;

  const body = (await res.json().catch(() => null)) as {
    error?: string;
  } | null;

  throw new Error(body?.error ?? `Request failed (${res.status})`);
}

export async function listReviewCases({ signal }: FetchOptions = {}) {
  const res = await reviews.cases.$get(undefined, { init: { signal } });
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
