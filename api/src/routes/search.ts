import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { searchQuerySchema, searchResponseSchema } from "@bluelearn/schemas";
import type { HonoEnv } from "../types";
import { errorResponses, jsonContent, validate } from "../lib/openapi";
import { rateLimitMiddleware } from "../middleware/rate-limit.middleware";
import { SEARCH } from "../middleware/rateLimits";
import { searchCollections } from "../services/search.service";

export const searchRouter = new Hono<HonoEnv>()
  // Full-text search, keyed by collection (default guides and objectives).
  // Supports filter_by / sort_by / facet_by passed straight through to
  // Typesense.
  .get(
    "/",
    describeRoute({
      tags: ["search"],
      summary: "Full-text search across collections",
      responses: {
        200: jsonContent(searchResponseSchema, "Hits keyed by collection"),
        ...errorResponses(400, 429),
      },
    }),
    rateLimitMiddleware({ ...SEARCH, bucket: "search" }),
    validate("query", searchQuerySchema),
    async (c) => {
      const results = await searchCollections(c.env, c.req.valid("query"));
      return c.json({ results }, 200);
    }
  );
