import { Hono } from "hono"
import { requireUser } from "../middleware/auth.middleware"
import type { HonoEnv } from "../types"

export const prerequisitesRouter = new Hono<HonoEnv>()
  // Add a prerequisite edge
  .post("/", requireUser, (c) => c.json({ error: "Not implemented" }, 501))

  // Remove a prerequisite edge by id
  .delete("/:id", requireUser, (c) => c.json({ error: "Not implemented" }, 501))

export const todosRouter = new Hono<HonoEnv>()
  // Shows all open TODO prerequisites
  .get("/", (c) => c.json({ error: "Not implemented" }, 501))

  // Declare a TODO prerequisite (missing prereq topic with no guide base yet)
  .post("/", requireUser, (c) => c.json({ error: "Not implemented" }, 501))
