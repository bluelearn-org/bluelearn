import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import type { Context, MiddlewareHandler } from "hono";
import type { Database } from "../database.types";
import type { HonoEnv } from "../types";

declare module "hono" {
  interface ContextVariableMap {
    supabase: SupabaseClient<Database>;
    // Set by requireUser so handlers reuse the authed user without re-fetching.
    user: User;
  }
}

export const supabaseMiddleware =
  (): MiddlewareHandler<HonoEnv> => async (c, next) => {
    const token = c.req.header("Authorization")?.replace("Bearer ", "");

    const supabase = createClient<Database>(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_PUBLISHABLE_KEY,
      {
        global: {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );

    if (token) {
      const { error } = await supabase.auth.getClaims(token);
      if (error) return c.json({ error: "Invalid or expired token" }, 401);
    }

    c.set("supabase", supabase);
    await next();
  };

export const getAuthenticatedUser = async (c: Context) => {
  const supabase = c.get("supabase");
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return { user, error: error?.message ?? null };
};

// Route guard: 401s unauthenticated requests before the handler runs.
export const requireUser: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const { user } = await getAuthenticatedUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  c.set("user", user);
  await next();
};

// Route guard for authoring mutations.
// The middleware checks suspension through Supabase, then rejects the
// request before the authoring mutation reaches the database.
// Database RLS remains authoritative.
export const requireUnsuspendedUser: MiddlewareHandler<HonoEnv> = async (
  c,
  next
) => {
  const { data, error } = await c
    .get("supabase")
    .from("profiles")
    .select("is_suspended")
    .eq("id", c.get("user").id)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error(error);
    return c.json({ error: "Unable to verify account status" }, 500);
  }
  if (data.is_suspended) {
    return c.json(
      { error: "Suspended users cannot create or edit guides." },
      403
    );
  }
  await next();
};

// Bypasses RLS — use only in webhooks / admin routes
export const getServiceSupabase = (c: Context<HonoEnv>) =>
  createClient<Database>(c.env.SUPABASE_URL, c.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
