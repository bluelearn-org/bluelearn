import type { InferRequestType } from "hono/client";
import { client } from "@/lib/api/apiClient";
import { assertOk } from "@/lib/api/apiHelpers";

const revisions = client["guide-revisions"];

type FetchOptions = { signal?: AbortSignal };

export async function getRevision(id: string, { signal }: FetchOptions = {}) {
  const res = await revisions[":id"].$get(
    { param: { id } },
    { init: { signal } }
  );
  await assertOk(res);

  return res.json();
}

export async function updateRevision(
  id: string,
  body: InferRequestType<(typeof revisions)[":id"]["$patch"]>["json"]
) {
  const res = await revisions[":id"].$patch({ param: { id }, json: body });
  await assertOk(res);

  return res.json();
}

// Diff of this revision against the guide's live revision.
export async function getRevisionDiff(
  id: string,
  { signal }: FetchOptions = {}
) {
  const res = await revisions[":id"].diff.prev.$get(
    { param: { id } },
    { init: { signal } }
  );
  await assertOk(res);

  return res.json();
}

// Forks a rejected submission into an editable draft or resumes the draft
// already opened for it.
export async function reviseRevision(id: string) {
  const res = await revisions[":id"].revise.$post({ param: { id } });
  await assertOk(res);

  const { revision_id } = await res.json();
  return revision_id;
}

// Flips the draft to submitted and opens a review case. 422 if incomplete.
export async function submitRevision(id: string) {
  const res = await revisions[":id"].submit.$post({ param: { id } });
  await assertOk(res);

  const { review_case_id } = await res.json();
  return review_case_id;
}
