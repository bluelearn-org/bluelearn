import type { Review } from "@/types/reveiws";
import type { CreateDecisionInput } from "../../../../packages/schemas/src/review";
import { client } from "@/lib/api/apiClient";

const reviews = client.reviews;

type FetchOptions = { signal?: AbortSignal };

// the same function used in subjects.ts, handles API error responses
async function assertOk(res: Response) {
  if (res.ok) return;

  const body = (await res.json().catch(() => null)) as {
    error?: string;
  } | null;

  throw new Error(body?.error ?? `Request failed (${res.status})`);
}

export async function getReviewQueue({ signal }: FetchOptions = {}) {
  const res = await reviews.queue.$get({ init: { signal } });
  await assertOk(res);
  const { cases: data } = await res.json();

  return data;
}

export async function listReviewCases({ signal }: FetchOptions = {}) {
  const res = await reviews.cases.$get({ init: { signal } });
  await assertOk(res);
  const { cases: data } = await res.json();

  return data;
}

export async function getReviewCase(id: string, { signal }: FetchOptions = {}) {
  const res = await reviews.cases[":id"].$get(
    { param: { id } },
    { init: { signal } }
  );
  await assertOk(res);
  const data = await res.json();

  return data;
}

export async function castDecision(
  id: string,
  reveiw: Review,
  { signal }: FetchOptions = {}
) {
  let payload: CreateDecisionInput;

  if (reveiw.decision == "approve") {
    payload = {
      decision: "approved",
      notes: reveiw.notes,
    };
  } else if (reveiw.decision == "reject") {
    payload = {
      decision: "rejected",
      notes: reveiw.notes,
      reasons: reveiw.reasons as Array<
        | "hierarchy_issue"
        | "factual_error"
        | "duplicate_content"
        | "scope_violation"
        | "clarity_issue"
        | "missing_required_information"
      >,
    };
  } else {
    throw new Error(`Reveiw post request made with missing body features.`);
  }
  // json payload
  const res = await reviews.cases[":id"].decisions.$post(
    {
      json: payload,
      param: { id },
    },
    { init: { signal } }
  );
  await assertOk(res);
}
