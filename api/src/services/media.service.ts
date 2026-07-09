import { SupabaseClient } from "@supabase/supabase-js";
import { ServiceError } from "../lib/service-error";
import type { Database } from "../database.types";

import { type FileUpload, type UUID } from "@bluelearn/schemas";

type DB = SupabaseClient<Database>;

export function fileNameCleaner(name: string) {
  // Clean file names before upload
  name = name.replaceAll(" ", "-"); // Replace spaces with en dashes
  name = name.replaceAll(/[^a-zA-Z0-9_.-]/g, ""); // Remove special characters
  return name;
}

export async function uploadMediaFile(
  file: FileUpload,
  userId: string,
  db: DB
) {
  // Uploads media file to bucket and store path in database
  const cleanFileName = fileNameCleaner(file.name);

  // Upload to storage. A random prefix keeps the storage_key unique even when
  // two files share a name or land in the same millisecond.
  const { data: uploadData, error: uploadError } = await db.storage
    .from("media")
    .upload(`uploads/${crypto.randomUUID()}_${cleanFileName}`, file);

  if (uploadError) {
    console.error(uploadError);
    throw new ServiceError("File upload failed", 500);
  }

  // Insert path of uploadData into database
  const { data: databaseEntry, error: databaseError } = await db
    .from("media_assets")
    .insert({
      storage_key: uploadData.path,
      uploaded_by: userId,
    })
    .select()
    .single();

  if (databaseError) {
    console.error("media_assets insert failed:", databaseError.message);
    throw new ServiceError("Failed to store file metadata in database", 500);
  }

  const {
    data: { publicUrl },
  } = db.storage.from("media").getPublicUrl(databaseEntry.storage_key);

  return {
    id: databaseEntry.id,
    url: publicUrl,
    path: databaseEntry.storage_key,
    mime_type: file.type,
  };
}

export async function assertRevisionLinkable(
  revision_id: UUID,
  userId: string,
  db: DB
) {
  const { data, error } = await db
    .from("guide_revisions")
    .select("id")
    .eq("id", revision_id)
    .eq("author_id", userId)
    .eq("status", "draft")
    .maybeSingle();

  if (error) {
    console.error("guide_revisions lookup failed:", error.message);
    throw new ServiceError("Failed to look up guide revision", 500);
  }
  if (!data) {
    throw new ServiceError("Guide revision not found", 404);
  }
}

export async function linkAssetToRevision(
  revision_id: UUID,
  asset_id: UUID,
  db: DB
) {
  const { data: revisionEntry, error: revisionInsertError } = await db
    .from("revision_assets")
    .insert({ revision_id, asset_id })
    .select()
    .single();

  if (revisionInsertError) {
    if (revisionInsertError.code === "23503") {
      throw new ServiceError("Guide revision not found", 404);
    }
    console.error(
      "revision_assets insert failed:",
      revisionInsertError.message
    );
    throw new ServiceError("Failed to create media revision entry", 500);
  }

  return revisionEntry;
}

export async function uploadRevisionMedia(
  file: FileUpload,
  revisionId: UUID,
  userId: string,
  db: DB
) {
  // Verify the revision before uploading, so a bad id fails fast and never
  // leaves an orphan file or asset row behind, then store and link the asset.
  await assertRevisionLinkable(revisionId, userId, db);
  const asset = await uploadMediaFile(file, userId, db);
  await linkAssetToRevision(revisionId, asset.id, db);
  return { url: asset.url, path: asset.path, mime_type: asset.mime_type };
}
