import type { SupabaseClient } from "@supabase/supabase-js";
import type { UpdateProfileInput } from "@bluelearn/schemas";
import type { Database } from "../database.types";
import { ServiceError } from "../lib/service-error";

type DB = SupabaseClient<Database>;

type GuideDraft = {
  revision_id: string;
  guide_id: string;
  title: string;
  guide_slug: string | null;
  created_at: string;
  updated_at: string;
};

type ObjectiveDraft = {
  revision_id: string;
  objective_id: string;
  title: string;
  objective_slug: string | null;
  created_at: string;
  updated_at: string;
};

async function fetchRoles(supabase: DB, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  return data?.map((r) => r.role) ?? [];
}

// Public badges. user_roles RLS hides other users' roles, so this reads with the
// service client (RLS bypass) and excludes admin in code.
async function fetchPublicBadges(service: DB, userId: string) {
  const { data } = await service
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .neq("role", "admin");
  return data?.map((r) => r.role) ?? [];
}

// Escape LIKE metacharacters so a username containing `_` is matched literally
// rather than as a wildcard.
const escapeLike = (value: string) => value.replace(/[%_\\]/g, "\\$&");

// Map profile ids to their @username. Listing cards show the original
// author/curator, so callers pass creator ids and read the handle back.
export async function loadUsernames(supabase: DB, ids: Array<string | null>) {
  const map = new Map<string, string>();
  const unique = [...new Set(ids.filter((id): id is string => id !== null))];
  if (unique.length === 0) return map;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", unique);

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load authors", 500);
  }
  for (const p of data ?? []) map.set(p.id, p.username);
  return map;
}

// The caller's own profile row and roles.
export async function getMyIdentity(supabase: DB, userId: string) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error || !profile) throw new ServiceError("Profile not found", 404);

  const roles = await fetchRoles(supabase, userId);
  return { profile, roles };
}

// The caller's own draft revisions. Guide drafts and objective drafts are returned
// as separate lists, each ordered most-recently-edited first.
export async function getMyDrafts(
  supabase: DB,
  userId: string
): Promise<{ guide_drafts: GuideDraft[]; objective_drafts: ObjectiveDraft[] }> {
  const [guides, objectives] = await Promise.all([
    supabase
      .from("guide_revisions")
      .select(
        // Two FKs relate revisions to guides (authorship + live pointer);
        // drafts hang off the authorship one.
        "id, guide_id, title, created_at, updated_at, guides!guide_revisions_guide_id_fkey(slug)"
      )
      .eq("author_id", userId)
      .eq("status", "draft")
      .order("updated_at", { ascending: false }),
    supabase
      .from("objective_revisions")
      .select(
        "id, objective_id, title, created_at, updated_at, objectives!objective_revisions_objective_id_fkey(slug)"
      )
      .eq("author_id", userId)
      .eq("status", "draft")
      .order("updated_at", { ascending: false }),
  ]);

  if (guides.error) {
    console.error(guides.error);
    throw new ServiceError("Failed to load drafts", 500);
  }
  if (objectives.error) {
    console.error(objectives.error);
    throw new ServiceError("Failed to load drafts", 500);
  }

  return {
    guide_drafts: guides.data.map((r) => ({
      revision_id: r.id,
      guide_id: r.guide_id,
      title: r.title ?? "Untitled",
      guide_slug: r.guides?.slug ?? null,
      created_at: r.created_at,
      updated_at: r.updated_at,
    })),
    objective_drafts: objectives.data.map((r) => ({
      revision_id: r.id,
      objective_id: r.objective_id,
      title: r.title ?? "Untitled",
      objective_slug: r.objectives?.slug ?? null,
      created_at: r.created_at,
      updated_at: r.updated_at,
    })),
  };
}

// Apply the caller's profile edits and return the updated row and roles.
export async function updateMyProfile(
  supabase: DB,
  userId: string,
  updates: UpdateProfileInput
) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    // unique_violation: username (or its case-insensitive form) is taken.
    if (error.code === "23505")
      throw new ServiceError("Username already taken", 409);
    console.error(error);
    throw new ServiceError("Failed to update profile", 500);
  }

  const roles = await fetchRoles(supabase, userId);
  return { profile, roles };
}

// A public profile by username. Reads roles with the service client because
// user_roles RLS hides them; suspended members are treated as not found.
export async function getPublicProfile(
  supabase: DB,
  service: DB,
  username: string
) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, created_at")
    .ilike("username", escapeLike(username))
    .eq("is_suspended", false)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load profile", 500);
  }
  if (!profile) throw new ServiceError("Profile not found", 404);

  const roles = await fetchPublicBadges(service, profile.id);

  // Drop the internal id from the public payload.
  const { id: _id, ...publicProfile } = profile;
  return { profile: publicProfile, roles };
}
