import { Hono } from "hono";
import { cors } from "hono/cors";
import { createClient } from "@supabase/supabase-js";
import { supabaseMiddleware } from "./middleware/auth.middleware";
import { ServiceError } from "./lib/service-error";
import { assemblePendingPanels } from "./services/review.service";
import type { Database } from "./database.types";
import type { Bindings, HonoEnv } from "./types";
import { meRouter, profilesRouter } from "./routes/identity";
import {
  guidesRouter,
  variantsRouter,
  guideRevisionsRouter,
} from "./routes/guides";
import {
  objectivesRouter,
  objectiveRevisionsRouter,
} from "./routes/objectives";
import { prerequisitesRouter, todosRouter } from "./routes/graph";
import { subjectsRouter } from "./routes/subjects";
import { reviewsRouter } from "./routes/reviews";
import { mediaRouter } from "./routes/media";

const app = new Hono<HonoEnv>()
  .use((c, next) => cors({ origin: c.env.APP_URL })(c, next))
  .use(supabaseMiddleware())
  .get("/", (c) => c.json({ ok: true }))

  .route("/me", meRouter)
  .route("/profiles", profilesRouter)
  .route("/guides", guidesRouter)
  .route("/variants", variantsRouter)
  .route("/guide-revisions", guideRevisionsRouter)
  .route("/objectives", objectivesRouter)
  .route("/objective-revisions", objectiveRevisionsRouter)
  .route("/prerequisites", prerequisitesRouter)
  .route("/todos", todosRouter)
  .route("/subjects", subjectsRouter)
  .route("/reviews", reviewsRouter)
  .route("/media", mediaRouter);

// Services throw ServiceError to signal HTTP-meaningful failures; map them to
// JSON here so handlers stay free of repeated `if (error) return c.json(...)`.
app.onError((err, c) => {
  if (err instanceof ServiceError)
    return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

// Scheduled trigger (schedule in wrangler.jsonc).
async function scheduled(_event: ScheduledController, env: Bindings) {
  const supabase = createClient<Database>(
    env.SUPABASE_URL,
    env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  await assemblePendingPanels(supabase);
}

// Default export doubles as the Workers handler and the cron entry: Hono serves
// fetch and scheduled runs assembly. Tests import it to call app.request().
export default Object.assign(app, { scheduled });
export type AppType = typeof app;
