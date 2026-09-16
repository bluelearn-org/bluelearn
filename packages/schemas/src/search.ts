import { z } from "zod";

// GET /search query params. Which collection names are valid is decided by
// the API's collection registry (search.service.ts), not here.
export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(256),
  // Comma-separated collection names, e.g. "guides" or "guides,objectives".
  collections: z
    .string()
    .trim()
    .default("guides,objectives")
    .transform((s) =>
      s
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
    ),
  // Raw Typesense expressions, passed through per collection. See
  // https://typesense.org/docs/latest/api/search.html
  filter_by: z.string().trim().max(512).optional(), // e.g. tags.name:=React
  sort_by: z.string().trim().max(256).optional(), // e.g. title:asc
  facet_by: z.string().trim().max(256).optional(), // e.g. tags.name
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(50).default(10),
});

export const searchHitSchema = z.object({
  document: z.record(z.string(), z.unknown()),
  highlights: z.array(z.record(z.string(), z.unknown())).optional(),
});

export const searchCollectionResultSchema = z.object({
  found: z.number().int(),
  page: z.number().int(),
  hits: z.array(searchHitSchema),
  facet_counts: z.array(z.record(z.string(), z.unknown())).optional(),
});

export const searchResponseSchema = z.strictObject({
  results: z.record(z.string(), searchCollectionResultSchema),
});

export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
export type SearchHit = z.infer<typeof searchHitSchema>;
export type SearchCollectionResult = z.infer<
  typeof searchCollectionResultSchema
>;
