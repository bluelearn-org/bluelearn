import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createDecisionSchema } from "@bluelearn/schemas";
import { requireUser } from "../middleware/auth.middleware";
import type { HonoEnv } from "../types";
import {
  castDecision,
  getReviewCase,
  getReviewQueue,
  listReviewCases,
} from "../services/review.service";

export const reviewsRouter = new Hono<HonoEnv>()
  // Open cases needing action from the current reviewer
  .get("/queue", requireUser, async (c) => {
    const cases = await getReviewQueue(c.get("supabase"), c.get("user").id);
    return c.json({ cases }, 200);
  })

  // All finished review cases — public browse
  .get("/cases", async (c) => {
    const cases = await listReviewCases(c.get("supabase"));
    return c.json({ cases }, 200);
  })

  // Case detail with panel, members, decisions, and linked revision
  .get("/cases/:id", async (c) => {
    const result = await getReviewCase(c.get("supabase"), c.req.param("id"));
    return c.json(result, 200);
  })

  // Cast a panel vote with written justification
  .post(
    "/cases/:id/decisions",
    requireUser,
    zValidator("json", createDecisionSchema),
    async (c) => {
      const input = c.req.valid("json");
      const result = await castDecision(
        c.get("supabase"),
        c.get("user").id,
        c.req.param("id"),
        input
      );
      return c.json({ decision: result }, 201);
    }
  );
