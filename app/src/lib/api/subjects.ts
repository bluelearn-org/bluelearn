import type {
  GuideListItem,
  ObjectiveListItem,
  SubjectListItem,
} from "@bluelearn/schemas";
import { client } from "@/lib/api/apiClient";
import { assertOk, collectAll } from "@/lib/api/apiHelpers";

const subjects = client.subjects;

type FetchOptions = { signal?: AbortSignal };

export async function listSubjects({ signal }: FetchOptions = {}) {
  return collectAll<SubjectListItem>(async (query) => {
    const res = await subjects.$get({ query }, { init: { signal } });
    await assertOk(res);

    const { subjects: items, total } = await res.json();
    return { items, total };
  });
}

export async function listGroupedSubjects({ signal }: FetchOptions = {}) {
  const res = await subjects.grouped.$get({}, { init: { signal } });
  await assertOk(res);

  const { groups } = await res.json();
  return groups;
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
  return collectAll<GuideListItem>(async (query) => {
    const res = await subjects[":slug"].guides.$get(
      { query, param: { slug } },
      { init: { signal } }
    );
    await assertOk(res);

    const { guides: items, total } = await res.json();
    return { items, total };
  });
}

export async function listSubjectObjectives(
  slug: string,
  { signal }: FetchOptions = {}
) {
  return collectAll<ObjectiveListItem>(async (query) => {
    const res = await subjects[":slug"].objectives.$get(
      { query, param: { slug } },
      { init: { signal } }
    );
    await assertOk(res);

    const { objectives: items, total } = await res.json();
    return { items, total };
  });
}
