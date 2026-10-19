import type { InferRequestType } from "hono/client";
import { client } from "@/lib/api/apiClient";
import { assertOk } from "@/lib/api/apiHelpers";

const reviewCase = client.reviews.cases[":id"];

type FetchOptions = { signal?: AbortSignal };

export async function getReviewAnnotations(
  id: string,
  { signal }: FetchOptions = {}
) {
  const res = await reviewCase.annotations.$get(
    { param: { id } },
    { init: { signal } }
  );
  await assertOk(res);

  return await res.json();
}

export type ReviewAnnotationsData = Awaited<
  ReturnType<typeof getReviewAnnotations>
>;
export type ReviewThread = ReviewAnnotationsData["threads"][number];
export type ReviewReply = ReviewThread["replies"][number];
export type ReviewSuggestion = ReviewAnnotationsData["suggestions"][number];
export type ReviewParticipant = NonNullable<ReviewThread["author"]>;
export type AnnotationPermissions = ReviewAnnotationsData["permissions"];
export type ReviewPublication = ReviewAnnotationsData["publication"];

export async function createReviewThread(
  id: string,
  json: InferRequestType<(typeof reviewCase)["threads"]["$post"]>["json"]
) {
  const res = await reviewCase.threads.$post({ param: { id }, json });
  await assertOk(res);

  const { thread } = await res.json();
  return thread;
}

export async function replyToReviewThread(
  id: string,
  threadId: string,
  json: InferRequestType<
    (typeof reviewCase)["threads"][":threadId"]["replies"]["$post"]
  >["json"]
) {
  const res = await reviewCase.threads[":threadId"].replies.$post({
    param: { id, threadId },
    json,
  });
  await assertOk(res);

  const { reply } = await res.json();
  return reply;
}

export async function createReviewSuggestion(
  id: string,
  json: InferRequestType<(typeof reviewCase)["suggestions"]["$post"]>["json"]
) {
  const res = await reviewCase.suggestions.$post({ param: { id }, json });
  await assertOk(res);

  const { suggestion } = await res.json();
  return suggestion;
}

// Only the guide author decides. The last pending decision can publish the
// guide, so the response carries the case status.
export async function decideReviewSuggestion(
  id: string,
  suggestionId: string,
  decision: "accepted" | "rejected"
) {
  const res = await reviewCase.suggestions[":suggestionId"].decision.$post({
    param: { id, suggestionId },
    json: { decision },
  });
  await assertOk(res);

  return await res.json();
}
