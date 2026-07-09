import { Hono } from "hono";
import { requireUser } from "../middleware/auth.middleware";
import type { HonoEnv } from "../types";
import { fileSchema, uuidSchema } from "@bluelearn/schemas";

import { uploadMediaFile, addMediaRevision } from "../services/media.service";

export const mediaRouter = new Hono<HonoEnv>()
  // 400 unless a valid file and a revision_id are present; returns the stored
  // asset's public url. Also links the asset to the draft revision.
  .post("/upload", requireUser, async (c) => {
    const userId = c.get("user").id;
    const body = await c.req.formData();

    const file = fileSchema.safeParse(body.get("file"));
    if (!file.success) {
      return c.json({ error: file.error.issues[0].message }, 400);
    }

    const revisionId = uuidSchema.safeParse(body.get("revision_id"));
    if (!revisionId.success) {
      return c.json({ error: "Missing or invalid revision_id" }, 400);
    }

    const supabase = c.get("supabase");
    const asset = await uploadMediaFile(file.data, userId, supabase);

    // Link the asset to the revision so it is tracked immediately.
    await addMediaRevision(revisionId.data, asset.id, supabase);

    return c.json(
      { url: asset.url, path: asset.path, mime_type: asset.mime_type },
      201
    );
  });
