import type { InferRequestType, InferResponseType } from "hono/client";
import { client } from "@/lib/api/apiClient";
import { assertOk } from "@/lib/api/apiHelpers";

const me = client.me;

type FetchOptions = { signal?: AbortSignal };

export type RoleApplication = InferResponseType<
  (typeof me)["role-applications"]["$get"],
  200
>["applications"][number];
export type ApplicableRole = InferRequestType<
  (typeof me)["role-applications"]["$post"]
>["json"]["role"];

export async function getMyIdentity({ signal }: FetchOptions = {}) {
  const res = await me.$get(undefined, { init: { signal, cache: "no-store" } });
  await assertOk(res);

  return await res.json();
}

export async function deleteMyAccount() {
  const res = await me.$delete();
  await assertOk(res);
}

export async function isUsernameAvailable(username: string) {
  try {
    const res = await client.profiles[":username"].$get({
      param: { username },
    });

    return !res.ok;
  } catch {
    return true;
  }
}

export async function getProfilePage(
  username: string,
  { signal }: FetchOptions = {}
) {
  const res = await client.profiles[":username"].$get(
    { param: { username } },
    { init: { signal } }
  );
  await assertOk(res);

  return await res.json();
}

export async function getGuideDrafts({ signal }: FetchOptions = {}) {
  const res = await client.me.drafts.$get({}, { init: { signal } });

  await assertOk(res);

  const data = await res.json();

  return data.guide_drafts;
}

// The caller's role applications, newest first.
export async function getMyRoleApplications({ signal }: FetchOptions = {}) {
  const res = await me["role-applications"].$get(undefined, {
    init: { signal, cache: "no-store" },
  });
  await assertOk(res);

  return await res.json();
}

// Apply for verifier or moderator. The statement is an optional note to the
// admins who decide.
export async function applyForRole(
  role: ApplicableRole,
  statement: string | null
) {
  const res = await me["role-applications"].$post({
    json: { role, statement },
  });
  await assertOk(res);

  return (await res.json()).application;
}
