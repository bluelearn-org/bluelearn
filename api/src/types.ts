export type Bindings = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY: string;
  APP_URL: string;
  // Optional. Bound in wrangler.jsonc via durable_objects.bindings. When
  // absent (tests, fresh `wrangler dev` before the migration runs),
  // rate-limit middleware falls back to an in-memory store.
  RATE_LIMITER?: DurableObjectNamespace;
};

export type HonoEnv = { Bindings: Bindings };
