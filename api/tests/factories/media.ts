import { insert, type Insert } from "../helpers";

export function createMediaAsset(
  uploaderId: string,
  overrides: Partial<Insert<"media_assets">> = {}
) {
  return insert("media_assets", {
    uploaded_by: uploaderId,
    storage_key: `test/${crypto.randomUUID()}.png`,
    ...overrides,
  });
}
