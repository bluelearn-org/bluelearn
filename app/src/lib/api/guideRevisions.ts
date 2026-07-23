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

// Flips the draft to submitted and opens a review case. 422 if incomplete.
export async function submitRevision(id: string) {
  const res = await revisions[":id"].submit.$post({ param: { id } });
  await assertOk(res);

  const { review_case_id } = await res.json();
  return review_case_id;
}
