import { Hono } from "hono";
import { generateAvatarSVG } from "../lib/avatar-generator";
import type { HonoEnv } from "../types";

export const avatarRouter = new Hono<HonoEnv>()
  // SVG avatar for a user, keyed off their Supabase id. No auth, no DB —
  // same id always renders the same image, so it's safe to cache hard.
  .get("/:id", (c) => {
    const id = c.req.param("id");

    // Uncomment the line below to debug incoming IDs during local development
    // console.log("Avatar requested for ID:", id);

    const svg = generateAvatarSVG(id);

    return c.body(svg, 200, {
      "Content-Type": "image/svg+xml",

      // Production cache: aggressively caches the image for 1 year
      "Cache-Control": "public, max-age=31536000, immutable",

      // Uncomment the line below (and comment the one above) to bypass caching during local testing
      // "Cache-Control": "no-cache, no-store, must-revalidate",
    });
  });
