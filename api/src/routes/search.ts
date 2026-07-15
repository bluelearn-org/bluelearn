import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { searchQuerySchema } from "@bluelearn/schemas";
import type { HonoEnv } from "../types";
import { searchCollections } from "../services/search.service";

export const searchRouter = new Hono<HonoEnv>()
  // Full-text search, keyed by collection (default "guides"). Supports
  // filter_by / sort_by / facet_by passed straight through to Typesense.
  .get("/", zValidator("query", searchQuerySchema), async (c) => {
    const results = await searchCollections(c.env, c.req.valid("query"));
    return c.json({ results }, 200);
  });
