import { client } from "@/lib/api/apiClient";
import { assertOk } from "@/lib/api/apiHelpers";

const media = client.media;

export async function uploadMedia(file: File, revisionId: string) {
  const res = await media.upload.$post({
    form: { file, revision_id: revisionId },
  });
  if (!res.ok) return assertOk(res) as Promise<never>;

  return await res.json();
}
