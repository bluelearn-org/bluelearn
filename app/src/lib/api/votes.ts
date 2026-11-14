import { downvoteReasons } from "@bluelearn/schemas";
import type { InferRequestType } from "hono/client";
import type { ComboboxItem } from "@/components/ui/combobox";
import { client } from "@/lib/api/apiClient";
import { assertOk } from "@/lib/api/apiHelpers";

const variants = client.variants;

type FetchOptions = { signal?: AbortSignal };

export type DownvoteReason = (typeof downvoteReasons)[number];

export type CastVoteBody = InferRequestType<
  (typeof variants)[":id"]["vote"]["$put"]
>["json"];

export async function getMyVote(id: string, { signal }: FetchOptions = {}) {
  const res = await variants[":id"].vote.$get(
    { param: { id } },
    { init: { signal } }
  );
  await assertOk(res);

  const { vote } = await res.json();
  return vote;
}

export async function castVote(id: string, body: CastVoteBody) {
  const res = await variants[":id"].vote.$put({ param: { id }, json: body });
  if (!res.ok) return assertOk(res) as Promise<never>;

  const { vote } = await res.json();
  return vote;
}

export async function retractVote(id: string) {
  const res = await variants[":id"].vote.$delete({ param: { id } });
  await assertOk(res);
}

export async function inspectDownvotes(
  target: { guideId: string } | { caseId: string },
  page: number,
  { signal }: FetchOptions = {}
) {
  const query = { page: String(page), limit: "20" };
  const res =
    "guideId" in target
      ? await variants[":id"].downvotes.$get(
          { param: { id: target.guideId }, query },
          { init: { signal } }
        )
      : await client.reviews.cases[":id"].downvotes.$get(
          { param: { id: target.caseId }, query },
          { init: { signal } }
        );

  await assertOk(res);
  return res.json();
}

// The display text for each reason.
const REASON_TEXT: Record<
  DownvoteReason,
  { label: string; description: string }
> = {
  unclear: {
    label: "Unclear",
    description: "Explanation is confusing or hard to follow",
  },
  factually_wrong: {
    label: "Factually Wrong",
    description: "Information contradicts verified information",
  },
  missing_step: {
    label: "Missing Step",
    description: "A necessary action or concept is skipped",
  },
  outdated: {
    label: "Outdated",
    description: "Information is no longer accurate or current",
  },
  broken_link: {
    label: "Broken Link",
    description: "Referenced links are inaccessible",
  },
  prereq_gap: {
    label: "Prerequisite Gap",
    description: "Assumes knowledge not covered in listed prerequisites",
  },
  wrong_level: {
    label: "Wrong Level",
    description: "Difficulty does not match the stated proficiency level",
  },
  scope_creep: {
    label: "Scope Creep",
    description: "Includes unnecessary details beyond the main topic",
  },
};

export const downvoteReasonItems: Array<ComboboxItem> = downvoteReasons.map(
  (value) => ({ value, ...REASON_TEXT[value] })
);
