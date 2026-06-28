import { Hono } from "hono"
import { requireUser } from "../middleware/auth.middleware"
import type { HonoEnv } from "../types"
import { createSubjectSchema } from "@bluelearn/schemas"
import { zValidator } from "@hono/zod-validator"
import {
  createSubject,
  getSubjectBySlug,
  listSubjectGuides,
  listSubjects,
} from "../services/subject.service"

export const subjectsRouter = new Hono<HonoEnv>()
  // List all subjects
  .get("/", async (c) => {
    const subjects = await listSubjects(c.get("supabase"))
    return c.json({ subjects }, 200)
  })

  // Create a subject
  .post("/", requireUser, zValidator("json", createSubjectSchema), async (c) => {
    const { name } = c.req.valid("json")
    const subject = await createSubject(c.get("supabase"), c.get("user").id, name)
    return c.json({ subject }, 201)
  })

  // Subject metadata only
  .get("/:slug", async (c) => {
    const subject = await getSubjectBySlug(c.get("supabase"), c.req.param("slug"))
    return c.json({ subject }, 200)
  })

  // Alphabetical list of guides carrying this subject tag
  .get("/:slug/guides", async (c) => {
    const guides = await listSubjectGuides(c.get("supabase"), c.req.param("slug"))
    return c.json({ guides }, 200)
  })
