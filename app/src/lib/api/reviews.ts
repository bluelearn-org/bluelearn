import type { Review } from "@/types/reviews";
import type { InferRequestType } from "hono/client";
import { client } from "@/lib/api/apiClient";
import { assertOk, collectAll } from "@/lib/api/apiHelpers";

const reviews = client.reviews;

type FetchOptions = { signal?: AbortSignal };

export type QueueCase = {
  id: string;
  case_type: string;
  status: string;
  title: string | null;
  created_at: string;
  decision: "approved" | "rejected" | null;
  expires_at: string | null;
};

export async function getReviewQueue({ signal }: FetchOptions = {}) {
  return collectAll<QueueCase>(async (query) => {
    const res = await reviews.queue.$get({ query }, { init: { signal } });
    await assertOk(res);

    const { cases: items, total } = await res.json();
    return { items, total };
  });
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
  review: Review,
  { signal }: FetchOptions = {}
) {
  let payload: InferRequestType<
    (typeof reviews)["cases"][":id"]["decisions"]["$post"]
  >["json"];

  if (review.decision == "approve") {
    payload = {
      decision: "approved",
      notes: review.notes,
    };
  } else if (review.decision == "reject") {
    payload = {
      decision: "rejected",
      notes: review.notes,
      reasons: review.reasons as Array<
        | "hierarchy_issue"
        | "factual_error"
        | "duplicate_content"
        | "scope_violation"
        | "clarity_issue"
        | "missing_required_information"
      >,
    };
  } else {
    throw new Error(`Review post request made with missing body features.`);
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
