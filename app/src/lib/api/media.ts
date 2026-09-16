import { client } from "@/lib/api/apiClient";
import { assertOk } from "@/lib/api/apiHelpers";

const media = client.media;

export async function uploadMedia(file: File, revisionId: string) {
  const res = await media.upload.$post({
    form: { file, revision_id: revisionId },
  });
  await assertOk(res);

  return await res.json();
}
