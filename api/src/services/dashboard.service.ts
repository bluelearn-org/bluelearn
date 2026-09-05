import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import type { ProfileActivityRow } from "./identity.service";
import { ServiceError } from "../lib/service-error";

// roles and status types
export type UserStatus =
  Database["public"]["Tables"]["user_statuses"]["Row"]["status"];
export type UserRole =
  Database["public"]["Tables"]["user_roles"]["Row"]["role"];

type DB = SupabaseClient<Database>;

export type DashboardAssignmentRow = ProfileActivityRow & {
  username: string;
  created_at: string;
  updated_at: string;
  time_limit: number;
  user_status: UserStatus;
};

export type RoleRow = {
  id: string;
  username: string;
  roles: string[];
  date_created: string;
  date_updated: string;
  status: string;
};

// everything fetched by fetchAllAssignments
type AssignmentSourceRow = {
  id: string;
  member_id: string | null;
  status: string;
  assigned_at: string;
  expires_at: string | null;
  review_panels: {
    id: string;
    case_id: string;
    review_cases: {
      id: string;
      case_type: string;
      status: string;
      created_at: string;
      updated_at: string;
      guide_review_cases: {
        guide_revision_id: string;
        guide_revisions: {
          title: string | null;
          change_summary: string | null;
        } | null;
      } | null;
    };
  };
};

// fetch status for specific user
export async function getUserStatus(supabase: DB, userId: string) {
  const { data, error } = await supabase
    .from("user_statuses")
    .select("status")
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error(error);
    if (error.code === "PGRST116") {
      throw new ServiceError("Could not fetch status: User not found.", 404);
    }
    throw new ServiceError("Failed to fetch user status.", 500);
  }

  return data.status;
}

// set user status
export async function markUserStatus(
  supabase: DB,
  userId: string,
  status: UserStatus
) {
  const { data, error } = await supabase
    .from("user_statuses")
    .upsert({ user_id: userId, status: status })
    .select();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to update user status.", 500);
  }

  return data;
}

// add role to user
export async function addRole(supabase: DB, userId: string, role: UserRole) {
  const { error } = await supabase
    .from("user_roles")
    .insert({ user_id: userId, role });

  if (error) {
    console.error(error);
    throw new ServiceError("Could not add role to user.", 500);
  }
}

// remove role from user
export async function removeRole(supabase: DB, userId: string, role: UserRole) {
  const { error } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("role", role);

  if (error) {
    console.error(error);
    throw new ServiceError("Could not remove role from user.", 500);
  }
}

// fetch all statuses and map them to id data
async function fetchStatuses(
  supabase: DB,
  ids: string[]
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("user_statuses")
    .select("user_id, status")
    .in("user_id", ids);

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to batch select user statuses.", 500);
  }
  if (!data) {
    throw new ServiceError("User statuses not found.", 404);
  }

  const statusMap = new Map<string, string>();
  for (const row of data ?? []) {
    statusMap.set(row.user_id, row.status);
  }

  return statusMap;
}

// fetch all roles (site-wide) and map to id data
async function fetchAllRoles(
  supabase: DB,
  ids: string[]
): Promise<Map<string, string[]>> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("*")
    .in("user_id", ids);

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to batch select user roles.", 500);
  }

  const roleMap = new Map<string, string[]>();
  for (const row of data ?? []) {
    if (!roleMap.has(row.user_id)) {
      roleMap.set(row.user_id, [row.role]);
    } else {
      roleMap.get(row.user_id)!.push(row.role);
    }
  }

  return roleMap;
}

// return map of all usernames
async function getUsernames(
  supabase: DB,
  ids: string[]
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", ids);

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to fetch username list.", 500);
  }

  const usernameMap = new Map<string, string>();
  for (const row of data ?? []) {
    usernameMap.set(row.id, row.username);
  }

  return usernameMap;
}

// return full list of user assignments
async function fetchAllAssignments(supabase: DB) {
  const { data: raw, error } = await supabase
    .from("panel_members")
    .select(
      `id, member_id, status, assigned_at, expires_at,
       review_panels!inner(
         id, case_id,
         review_cases!inner(
           id, case_type, status, created_at, updated_at,
           guide_review_cases(
             guide_revision_id,
             guide_revisions(title, change_summary)
           )
         )
       )`
    )
    .in("status", ["assigned", "completed"]);

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load assignments", 500);
  }

  const rows = (raw ?? []) as unknown as AssignmentSourceRow[];

  return rows.map((r) => {
    const rc = r.review_panels.review_cases;
    return {
      user_id: r.member_id,
      panel_id: r.review_panels.id,
      date_created: rc.created_at,
      date_updated: rc.updated_at,
      type: rc.case_type,
      title: rc.guide_review_cases?.guide_revisions?.title ?? null,
      change_summary:
        rc.guide_review_cases?.guide_revisions?.change_summary ?? null,
      status: r.status,
      expires_at: r.expires_at,
    };
  });
}

// fetch a list of all user ids for above global selection functions
export async function getUserIds(supabase: DB) {
  const { data, error } = await supabase.from("profiles").select("id");

  if (error) {
    console.error(error);
    throw new ServiceError("Could not fetch user list.", 500);
  }
  if (!data) {
    throw new ServiceError("Could not fetch user list.", 500);
  }

  return data.map((r) => {
    return r.id;
  });
}

// select all data from across different table for roles table
export async function fetchRolesTable(supabase: DB) {
  const ids = await getUserIds(supabase);

  const [profiles, statuses, roles] = await Promise.all([
    supabase.from("profiles").select("id, username, created_at, updated_at"),
    fetchStatuses(supabase, ids),
    fetchAllRoles(supabase, ids),
  ]);

  // quick check for profiles errors
  if (profiles.error || !profiles.data) {
    throw new ServiceError("Could not batch select profiles.", 500);
  }

  return profiles.data.map((profile) => ({
    id: profile.id,
    username: profile.username,
    roles: roles.get(profile.id) ?? [],
    date_created: profile.created_at,
    date_updated: profile.updated_at,
    status: statuses.get(profile.id),
  }));
}

// fetch data for the members table
export async function fetchMembersTable(supabase: DB) {
  const ids = await getUserIds(supabase);
  const [profiles, statuses] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, display_name, created_at, updated_at, bio"),
    fetchStatuses(supabase, ids),
  ]);

  // quick check for profiles errors
  if (profiles.error || !profiles.data) {
    throw new ServiceError("Could not batch select profiles.", 500);
  }

  return profiles.data.map((profile) => ({
    id: profile.id,
    username: profile.username,
    display_name: profile.display_name,
    bio: profile.bio,
    date_created: profile.created_at,
    date_updated: profile.updated_at,
    status: statuses.get(profile.id),
  }));
}

// get assignments table
export async function fetchAssignmentsTable(supabase: DB) {
  const ids = await getUserIds(supabase);
  const [profiles, statuses, assignments] = await Promise.all([
    getUsernames(supabase, ids),
    fetchStatuses(supabase, ids),
    fetchAllAssignments(supabase),
  ]);

  return assignments.map((a) => ({
    id: a.user_id,
    panel_id: a.panel_id,
    username: profiles.get(a.user_id!),
    type: a.type,
    title: a.title ?? "",
    date_created: a.date_created,
    date_updated: a.date_updated,
    change_summary: a.change_summary ?? "",
    status: a.status,
    user_status: statuses.get(a.user_id!),
    time_left: a.expires_at,
  }));
}

// suspend a user
export async function suspendUser(supabase: DB, userId: string) {
  const [, profile] = await Promise.all([
    markUserStatus(supabase, userId, "suspended"),
    supabase.from("profiles").update({ is_suspended: true }).eq("id", userId),
  ]);

  if (profile.error || !profile) {
    console.error(profile.error);
    throw new ServiceError("Failed to mark user profile as suspended", 500);
  }
}

// unsuspend a user
export async function unsuspendUser(supabase: DB, userId: string) {
  const [, profile] = await Promise.all([
    markUserStatus(supabase, userId, "active"),
    supabase.from("profiles").update({ is_suspended: false }).eq("id", userId),
  ]);

  if (profile.error || !profile) {
    console.error(profile.error);
    throw new ServiceError("Failed to mark user profile as unsuspended", 500);
  }
}

// reassign a member of a panel
export async function reassignPanelMember(
  supabase: DB,
  userId: string,
  panelId: string
) {
  const { error } = await supabase.rpc("reassign_panel_member", {
    p_panel_id: panelId,
    p_member_id: userId,
  });

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to reassign panel member", 500);
  }
}
