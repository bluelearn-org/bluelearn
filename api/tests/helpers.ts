import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/database.types";
import type { Bindings } from "../src/types";

// Bindings passed as the third arg of `app.request(path, init, env)`.
// Sourced from .env.test only.
export const env: Bindings = {
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY!,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY!,
  APP_URL: process.env.APP_URL ?? "http://localhost:3000",
};

// Refuses to run against anything but a local Supabase.
if (!/127\.0\.0\.1|localhost/.test(env.SUPABASE_URL ?? "")) {
  throw new Error(
    `Refusing to run tests against non-local DB: ${env.SUPABASE_URL}`
  );
}

type DB = SupabaseClient<Database>;
export type Tables = Database["public"]["Tables"];
export type Insert<T extends keyof Tables> = Tables[T]["Insert"];
export type Row<T extends keyof Tables> = Tables[T]["Row"];

export const admin: DB = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Unwrap a Supabase { data, error } result: throw on error so a bad insert
// fails the test at the cause, and return deta as non-null so callers get a
// clean row without null-checks.
function unwrap<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data as T;
}

// Seed one row with the service client (bypasses RLS) and return it. The
// factories in tests/factories/ wrap this per table.
export async function insert<T extends keyof Tables>(
  table: T,
  values: Insert<T>
): Promise<Row<T>> {
  return unwrap(
    await admin
      .from(table)
      .insert(values as never)
      .select()
      .single()
  ) as Row<T>;
}

export async function makeUser(): Promise<{ token: string; userId: string }> {
  const email = `test-${crypto.randomUUID()}@example.com`;
  const password = "password123";

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (createError) throw createError;

  const anon = createClient<Database>(
    env.SUPABASE_URL,
    env.SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data: session, error: signInError } =
    await anon.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  return { token: session.session.access_token, userId: created.user.id };
}

// Shorthand for the Authorization header bundle most requests need.
export function auth(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

// Shorthand for an authorized JSON request init.
export function jsonAuth(token: string, method: string, body: unknown) {
  return {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}
