import { client } from "@/lib/api/apiClient";

const subjects = client.subjects;

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

export async function listSubjects({ signal }: FetchOptions = {}) {
  const res = await subjects.$get(undefined, { init: { signal } });
  await assertOk(res);

  const { subjects: data } = await res.json();
  return data;
}

export async function getSubjectBySlug(
  slug: string,
  { signal }: FetchOptions = {}
) {
  const res = await subjects[":slug"].$get(
    { param: { slug } },
    { init: { signal } }
  );
  await assertOk(res);

  const { subject } = await res.json();
  return subject;
}

export async function listSubjectGuides(
  slug: string,
  { signal }: FetchOptions = {}
) {
  const res = await subjects[":slug"].guides.$get(
    { param: { slug } },
    { init: { signal } }
  );
  await assertOk(res);

  const { guides } = await res.json();
  return guides;
}

export async function listSubjectObjectives(
  slug: string,
  { signal }: FetchOptions = {}
) {
  const res = await subjects[":slug"].objectives.$get(
    { param: { slug } },
    { init: { signal } }
  );
  await assertOk(res);

  const { objectives } = await res.json();
  return objectives;
}
