import type { InferRequestType } from "hono/client";
import type { UUID } from "node:crypto";
import { client } from "@/lib/api/apiClient";
import { assertOk } from "@/lib/api/apiHelpers";

const revisions = client["guide-revisions"];

type FetchOptions = { signal?: AbortSignal };

export type RemoteRevision = {
  revision: {
    id: string;
    guide_id: string;
    title: string | null;
    summary: string | null;
    body: string | null;
    change_summary: string | null;
    status: "draft" | "submitted";
    created_at: string;
  };
  subjects: Array<{
    id: string;
    slug: string | null;
    name: string;
    summary: string | null;
    status: "draft" | "published";
  }>;
  knowledge_type: "theoretical" | "practical" | null;
  is_variant: boolean;
  base_slug: string | null;
  variant_slug: string | null;
  prerequisites: Array<string>;
  todos: Array<{
    title: string;
    summary: string;
  }>;
  revised_from_case_id: string | null;
};

export type LocalRevision = {
  localDraftId: UUID;
  type: "variant" | "guide" | "";
  data: {
    type: "theoretical" | "practical" | "";
    title: string;
    summary: string;
    baseGuide: string;
    body: string;
    subjects: Array<{
      id: string;
      slug: string | null;
      name: string;
      summary: string | null;
      status: "draft" | "published";
    }>;
    newSubjects: Array<string>;
    prereqs: Array<string>;
    todoPrereqs: Array<{
      title: string;
      summary: string;
    }>;
  };
  revisionId: string;
  step: string;
  updatedAt: number;
};

export async function getRevision(
  id: string,
  { signal }: FetchOptions = {}
): Promise<RemoteRevision> {
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
