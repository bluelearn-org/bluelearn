import type { MiddlewareHandler } from "hono";
import type { HonoEnv } from "../types";

type RateLimitOptions = {
  windowSeconds: number;
  max: number;
  message?: string;
};

type Counter = { count: number; resetAt: number };

interface RateLimiterStore {
  hit(windowSeconds: number): Promise<Counter>;
}

// In-memory store used when no Durable Object binding is present (tests,
// fresh `wrangler dev` before the DO migration runs). Counters are
// process-scoped and reset on restart -- fine for local dev and test
// suites. A singleton keeps middleware instances sharing the same
// counters during test runs.
function createInMemoryStore(): RateLimiterStore {
  const counters = new Map<number, Counter>();
  return {
    async hit(windowSeconds) {
      const now = Math.floor(Date.now() / 1000);
      const existing = counters.get(windowSeconds);
      let counter: Counter;
      if (!existing || existing.resetAt <= now) {
        counter = { count: 1, resetAt: now + windowSeconds };
      } else {
        counter = {
          count: existing.count + 1,
          resetAt: existing.resetAt,
        };
      }
      counters.set(windowSeconds, counter);
      return counter;
    },
  };
}

const inMemoryStore = createInMemoryStore();

async function hitDurableObject(
  namespace: DurableObjectNamespace,
  key: string,
  windowSeconds: number
): Promise<Counter> {
  const id = namespace.idFromName(key);
  const stub = namespace.get(id);
  const res = await stub.fetch("https://do/internal/hit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "hit", windowSeconds }),
  });
  if (!res.ok) {
    throw new Error(
      `RateLimiterDurableObject returned ${res.status}: ${await res.text()}`
    );
  }
  return (await res.json()) as Counter;
}

// Per-route rate-limit middleware. Must be mounted AFTER requireUser so
// that c.get("user") is populated -- we key exclusively on the
// authenticated user id. Returns 429 with a Retry-After header once the
// limit is exceeded.
export function rateLimitMiddleware(
  options: RateLimitOptions
): MiddlewareHandler<HonoEnv> {
  return async (c, next) => {
    const user = c.get("user");
    // Defensive -- requireUser should always run first.
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const key = `user:${user.id}`;

    const { count, resetAt } = c.env.RATE_LIMITER
      ? await hitDurableObject(c.env.RATE_LIMITER, key, options.windowSeconds)
      : await inMemoryStore.hit(options.windowSeconds);

    const remaining = Math.max(0, options.max - count);
    const now = Math.floor(Date.now() / 1000);
    const retryAfter = Math.max(1, resetAt - now);

    c.header("RateLimit-Limit", String(options.max));
    c.header("RateLimit-Remaining", String(remaining));
    c.header("RateLimit-Reset", String(retryAfter));

    if (count > options.max) {
      c.header("Retry-After", String(retryAfter));
      return c.json({ error: options.message ?? "Rate limit exceeded" }, 429);
    }

    await next();
  };
}
