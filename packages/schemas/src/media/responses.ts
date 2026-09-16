import { z } from "zod";

export const mediaUploadResponseSchema = z.strictObject({
  url: z.url(),
  path: z.string(),
  mime_type: z.string(),
});

export type MediaUploadResponse = z.infer<typeof mediaUploadResponseSchema>;
