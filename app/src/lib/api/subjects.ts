import { client } from "@/lib/api/apiClient";
import { assertOk } from "@/lib/api/apiHelpers";

const subjects = client.subjects;

type FetchOptions = { signal?: AbortSignal };

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
