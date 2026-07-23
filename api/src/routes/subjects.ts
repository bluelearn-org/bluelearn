import { Hono } from "hono";
import type { HonoEnv } from "../types";
import {
  getSubjectBySlug,
  listSubjectGuides,
  listSubjectObjectives,
  listSubjects,
} from "../services/subject.service";

export const subjectsRouter = new Hono<HonoEnv>()
  // List all subjects
  .get("/", async (c) => {
    const subjects = await listSubjects(c.get("supabase"));
    return c.json({ subjects }, 200);
  })

  // Subject metadata only
  .get("/:slug", async (c) => {
    const subject = await getSubjectBySlug(
      c.get("supabase"),
      c.req.param("slug")
    );
    return c.json({ subject }, 200);
  })

  // Alphabetical list of guides carrying this subject tag
  .get("/:slug/guides", async (c) => {
    const guides = await listSubjectGuides(
      c.get("supabase"),
      c.req.param("slug")
    );
    return c.json({ guides }, 200);
  })

  // Alphabetical list of published objectives tagged with this subject
  .get("/:slug/objectives", async (c) => {
    const objectives = await listSubjectObjectives(
      c.get("supabase"),
      c.req.param("slug")
    );
    return c.json({ objectives }, 200);
  });
