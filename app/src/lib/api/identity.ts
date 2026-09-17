import { client } from "@/lib/api/apiClient";
import { assertOk } from "@/lib/api/apiHelpers";

const me = client.me;

export async function getMyDateOfBirth() {
  const res = await me["date-of-birth"].$get();
  await assertOk(res);
  return res.json();
}

export async function updateMyDateOfBirth(date_of_birth: string | null) {
  const res = await me["date-of-birth"].$patch({ json: { date_of_birth } });
  await assertOk(res);
  return res.json();
}

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
