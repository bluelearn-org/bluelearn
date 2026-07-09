import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireUser } from "../middleware/auth.middleware";
import type { HonoEnv } from "../types";
import { mediaUploadSchema } from "@bluelearn/schemas";

import { uploadRevisionMedia } from "../services/media.service";

export const mediaRouter = new Hono<HonoEnv>()
  // 400 unless a valid file and revision_id are present; returns the stored
  // asset's public url and links it to the draft revision.
  .post(
    "/upload",
    requireUser,
    zValidator("form", mediaUploadSchema),
    async (c) => {
      const { file, revision_id } = c.req.valid("form");
      const asset = await uploadRevisionMedia(
        file,
        revision_id,
        c.get("user").id,
        c.get("supabase")
      );
      return c.json(asset, 201);
    }
  );
