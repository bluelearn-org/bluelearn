import { client } from "@/lib/api/apiClient";
import { assertOk } from "@/lib/api/apiHelpers";

const me = client.me;

type FetchOptions = { signal?: AbortSignal };

export async function getMyIdentity({ signal }: FetchOptions = {}) {
  const res = await me.$get(undefined, { init: { signal } });
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
