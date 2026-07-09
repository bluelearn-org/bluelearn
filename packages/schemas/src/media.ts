import { z } from "zod";

export const fileSchema = z
  .file()
  .max(10_000_000, "File must be under 10 MB")
  .mime(
    ["image/png", "image/jpeg", "image/webp"],
    "Must be a PNG, JPEG, or WebP"
  );

export const uuidSchema = z.uuid();

export const mediaUploadSchema = z.object({
  file: fileSchema,
  revision_id: uuidSchema,
});

export type FileUpload = z.infer<typeof fileSchema>;
export type UUID = z.infer<typeof uuidSchema>;
export type MediaUploadInput = z.infer<typeof mediaUploadSchema>;
