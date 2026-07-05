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
type Tables = Database["public"]["Tables"];
type Insert<T extends keyof Tables> = Tables[T]["Insert"];
type Row<T extends keyof Tables> = Tables[T]["Row"];

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

async function insert<T extends keyof Tables>(
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

// Create an authenticated user. Returns the access token to send as
// `Authorization: Bearer <token>`.
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

export function createReviewCase(
  createdBy: string,
  overrides: Partial<Insert<"review_cases">> = {}
) {
  return insert("review_cases", {
    case_type: "guide_publish",
    status: "pending",
    created_by: createdBy,
    ...overrides,
  });
}

export function createReviewPanel(
  caseId: string,
  overrides: Partial<Insert<"review_panels">> = {}
) {
  return insert("review_panels", {
    case_id: caseId,
    target_seat_count: 1,
    ...overrides,
  });
}

export function createPanelMember(
  panelId: string,
  memberId: string,
  overrides: Partial<Insert<"panel_members">> = {}
) {
  return insert("panel_members", {
    panel_id: panelId,
    member_id: memberId,
    status: "assigned",
    ...overrides,
  });
}

export function createGuideBase(
  overrides: Partial<Insert<"guide_bases">> = {}
) {
  return insert("guide_bases", {
    slug: `guide-${crypto.randomUUID()}`,
    title: "Test Guide",
    knowledge_type: "theory",
    ...overrides,
  });
}

export function createGuide(
  guideBaseId: string,
  overrides: Partial<Insert<"guides">> = {}
) {
  return insert("guides", { guide_base_id: guideBaseId, ...overrides });
}

export function createGuideRevision(
  guideId: string,
  overrides: Partial<Insert<"guide_revisions">> = {}
) {
  return insert("guide_revisions", {
    guide_id: guideId,
    title: "Test Guide",
    ...overrides,
  });
}

// Links a review case to the exact guide revision it judges. This is what gives
// a queued guide case its title in the /reviews/queue response.
export function createGuideReviewCase(
  caseId: string,
  guideRevisionId: string,
  overrides: Partial<Insert<"guide_review_cases">> = {}
) {
  return insert("guide_review_cases", {
    case_id: caseId,
    guide_revision_id: guideRevisionId,
    ...overrides,
  });
}
