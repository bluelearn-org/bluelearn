import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { openAPIRouteHandler } from "hono-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { openApiDocumentation } from "./lib/openapi";
import { avatarRouter } from "./routes/avatar";
import { createClient } from "@supabase/supabase-js";
import { supabaseMiddleware } from "./middleware/auth.middleware";
import { rateLimitMiddleware } from "./middleware/rate-limit.middleware";
import { READ } from "./middleware/rateLimits";
import { ServiceError } from "./lib/service-error";
import {
  assemblePendingPanels,
  sweepExpiredReviewSeats,
} from "./services/review.service";
import { promoteAllCanonicals } from "./services/promotion.service";
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
import { searchRouter } from "./routes/search";

let specHandler: MiddlewareHandler<HonoEnv> | undefined;
const openApiHandler: MiddlewareHandler<HonoEnv> = (c, next) => {
  specHandler ??= openAPIRouteHandler(app, {
    documentation: openApiDocumentation,
  });
  return specHandler(c, next);
};

const app = new Hono<HonoEnv>()
  .use((c, next) => cors({ origin: c.env.APP_URL })(c, next))
  .use(rateLimitMiddleware({ ...READ, bucket: "global-read" }))
  .get("/", (c) => c.json({ ok: true }))
  .get("/openapi", openApiHandler)
  .get("/docs", Scalar({ url: "/openapi" }))
  .route("/avatar", avatarRouter)
  .use(supabaseMiddleware())
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
  .route("/media", mediaRouter)
  .route("/search", searchRouter);

// Services throw ServiceError to signal HTTP-meaningful failures; map them to
// JSON here so handlers stay free of repeated `if (error) return c.json(...)`.
app.onError((err, c) => {
  if (err instanceof ServiceError)
    return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

// Scheduled trigger (schedules in wrangler.jsonc).
async function scheduled(event: ScheduledController, env: Bindings) {
  const supabase = createClient<Database>(
    env.SUPABASE_URL,
    env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  if (event.cron === "*/5 * * * *") {
    await Promise.allSettled([
      assemblePendingPanels(supabase),
      sweepExpiredReviewSeats(supabase),
    ]);
  }
  if (event.cron === "0 */12 * * *") await promoteAllCanonicals(supabase);
}

// Default export doubles as the Workers handler and the cron entry: Hono serves
// fetch and scheduled runs assembly. Tests import it to call app.request().
export default Object.assign(app, { scheduled });
export type AppType = typeof app;

export { RateLimiterDurableObject } from "./durable-objects/rate-limiter.do";
