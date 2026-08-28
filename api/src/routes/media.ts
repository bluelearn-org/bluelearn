import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { requireUser } from "../middleware/auth.middleware";
import { rateLimitMiddleware } from "../middleware/rate-limit.middleware";
import { HEAVY } from "../middleware/rateLimits";
import type { HonoEnv } from "../types";
import {
  mediaUploadResponseSchema,
  mediaUploadSchema,
} from "@bluelearn/schemas";
import { errorResponses, jsonContent, validate } from "../lib/openapi";

import { uploadRevisionMedia } from "../services/media.service";

export const mediaRouter = new Hono<HonoEnv>()
  // 400 unless a valid file and revision_id are present; returns the stored
  // asset's public url and links it to the draft revision.
  .post(
    "/upload",
    describeRoute({
      tags: ["media"],
      summary: "Upload a file to object storage",
      security: [{ bearerAuth: [] }],
      responses: {
        201: jsonContent(mediaUploadResponseSchema, "The stored asset"),
        ...errorResponses(400, 401, 404, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...HEAVY, bucket: "media-upload" }),
    validate("form", mediaUploadSchema),
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
