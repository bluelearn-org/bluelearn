import { Hono } from "hono"
import { cors } from "hono/cors"
import { supabaseMiddleware } from "./middleware/auth.middleware"
import { ServiceError } from "./lib/service-error"
import type { HonoEnv } from "./types"
import { meRouter, profilesRouter } from "./routes/identity"
import { guidesRouter, variantsRouter, guideRevisionsRouter } from "./routes/guides"
import { learningPathsRouter, learningPathRevisionsRouter } from "./routes/learning-paths"
import { prerequisitesRouter, todosRouter } from "./routes/graph"
import { subjectsRouter } from "./routes/subjects"
import { reviewsRouter } from "./routes/reviews"
import { mediaRouter } from "./routes/media"

const app = new Hono<HonoEnv>()
  .use((c, next) => cors({ origin: c.env.APP_URL })(c, next))
  .use(supabaseMiddleware())
  .get("/", (c) => c.json({ ok: true }))

  .route("/me", meRouter)
  .route("/profiles", profilesRouter)
  .route("/guides", guidesRouter)
  .route("/variants", variantsRouter)
  .route("/guide-revisions", guideRevisionsRouter)
  .route("/paths", learningPathsRouter)
  .route("/path-revisions", learningPathRevisionsRouter)
  .route("/prerequisites", prerequisitesRouter)
  .route("/todos", todosRouter)
  .route("/subjects", subjectsRouter)
  .route("/reviews", reviewsRouter)
  .route("/media", mediaRouter)

// Services throw ServiceError to signal HTTP-meaningful failures; map them to
// JSON here so handlers stay free of repeated `if (error) return c.json(...)`.
app.onError((err, c) => {
  if (err instanceof ServiceError) return c.json({ error: err.message }, err.status)
  console.error(err)
  return c.json({ error: "Internal server error" }, 500)
})

export default app
export type AppType = typeof app
