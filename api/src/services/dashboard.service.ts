import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type {
  AssignmentsTableQuery,
  MembersTableQuery,
  RoleApplicationDecision,
  RoleApplicationsTableQuery,
  RolesTableQuery,
} from "@bluelearn/schemas";
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

type FilterKind = "text" | "choice" | "roles" | "range";
type TableColumns = Record<string, { column: string; kind: FilterKind }>;

const memberColumns = {
  username: { column: "username", kind: "text" },
  display_name: { column: "display_name", kind: "text" },
  bio: { column: "bio", kind: "text" },
  date_created: { column: "created_at", kind: "range" },
  date_updated: { column: "updated_at", kind: "range" },
  status: { column: "status", kind: "choice" },
} satisfies TableColumns;

const roleColumns = {
  username: { column: "username", kind: "text" },
  roles: { column: "roles", kind: "roles" },
  date_created: { column: "created_at", kind: "range" },
  date_updated: { column: "updated_at", kind: "range" },
  status: { column: "status", kind: "choice" },
} satisfies TableColumns;

const assignmentColumns = {
  username: { column: "username", kind: "text" },
  user_status: { column: "member_status", kind: "choice" },
  time_left: { column: "expires_at", kind: "range" },
  status: { column: "status", kind: "choice" },
  type: { column: "case_type", kind: "choice" },
  title: { column: "title", kind: "text" },
  change_summary: { column: "change_summary", kind: "text" },
  date_created: { column: "created_at", kind: "range" },
  date_updated: { column: "updated_at", kind: "range" },
} satisfies TableColumns;

const roleApplicationColumns = {
  username: { column: "username", kind: "text" },
  role: { column: "role", kind: "choice" },
  status: { column: "status", kind: "choice" },
  statement: { column: "statement", kind: "text" },
  date_created: { column: "created_at", kind: "range" },
  date_decided: { column: "decided_at", kind: "range" },
} satisfies TableColumns;

type TableQuery =
  | MembersTableQuery
  | RolesTableQuery
  | AssignmentsTableQuery
  | RoleApplicationsTableQuery;

type TableRequest<B> = PromiseLike<{
  data: unknown;
  count: number | null;
  error: PostgrestError | null;
}> & {
  filter(column: string, operator: string, value: unknown): B;
  or(filters: string): B;
  order(
    column: string,
    options: { ascending: boolean; nullsFirst: boolean }
  ): B;
  range(from: number, to: number): B;
};

// Search inputs are literal text; % and _ must not widen member matches.
function containsPattern(text: string) {
  return `%${text.replace(/[\\%_]/g, "\\$&")}%`;
}

function filterTable<B extends TableRequest<B>>(
  request: B,
  columns: TableColumns,
  query: TableQuery
): B {
  const params: Record<string, unknown> = query;

  for (const [key, { column, kind }] of Object.entries(columns)) {
    const value = params[key];

    if (kind === "range") {
      const from = params[`${key}_from`];
      const to = params[`${key}_to`];
      if (typeof from === "string")
        request = request.filter(column, "gte", from);
      if (typeof to === "string") request = request.filter(column, "lt", to);
      continue;
    }

    if (kind === "text") {
      const text = typeof value === "string" ? value.trim() : "";
      if (text)
        request = request.filter(column, "ilike", containsPattern(text));
      continue;
    }

    const picked: string[] = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? [value]
        : [];
    if (picked.length === 0) continue;

    // "none" means no status for a choice column and no roles for `roles`.
    const known = picked.filter((choice) => choice !== "none").join(",");
    const matches: string[] = [];
    if (known) {
      matches.push(
        kind === "roles" ? `${column}.ov.{${known}}` : `${column}.in.(${known})`
      );
    }
    if (picked.includes("none")) {
      matches.push(kind === "roles" ? `${column}.eq.{}` : `${column}.is.null`);
    }
    request = request.or(matches.join(","));
  }

  return request;
}

// An out-of-range page still needs its filtered total so pagination can recover.
async function fetchTablePage<B extends TableRequest<B>>(
  select: (options: { head: boolean }) => B,
  columns: TableColumns,
  query: TableQuery,
  tiebreakers: string[],
  failure: string
) {
  const first = (query.page - 1) * query.limit;
  const sortColumn = query.sortBy ? columns[query.sortBy].column : "created_at";
  let request = filterTable(select({ head: false }), columns, query).order(
    sortColumn,
    { ascending: query.sortDirection === "asc", nullsFirst: false }
  );
  for (const column of tiebreakers) {
    request = request.order(column, { ascending: true, nullsFirst: false });
  }

  const { data, count, error } = await request.range(
    first,
    first + query.limit - 1
  );

  // PostgREST answers 416 (PGRST103) when the offset is past the last row.
  if (error?.code === "PGRST103") {
    const counted = await filterTable(select({ head: true }), columns, query);
    if (counted.error) {
      console.error(counted.error);
      throw new ServiceError(failure, 500);
    }
    return { rows: [] as Awaited<B>["data"], total: counted.count ?? 0 };
  }
  if (error) {
    console.error(error);
    throw new ServiceError(failure, 500);
  }

  return { rows: data as Awaited<B>["data"], total: count ?? 0 };
}

// select one page of data from the dashboard view for the roles table
export async function fetchRolesTable(supabase: DB, query: RolesTableQuery) {
  const { rows, total } = await fetchTablePage(
    ({ head }) =>
      supabase
        .from("dashboard_members")
        .select("id, username, roles, created_at, updated_at, status", {
          count: "exact",
          head,
        }),
    roleColumns,
    query,
    ["id"],
    "Failed to load the roles table."
  );

  const data = (rows ?? []).map((row) => ({
    id: row.id!,
    username: row.username!,
    roles: row.roles ?? [],
    date_created: row.created_at!,
    date_updated: row.updated_at!,
    status: row.status ?? undefined,
  }));

  return { data, total };
}

// fetch one page of data for the members table
export async function fetchMembersTable(
  supabase: DB,
  query: MembersTableQuery
) {
  const { rows, total } = await fetchTablePage(
    ({ head }) =>
      supabase
        .from("dashboard_members")
        .select(
          "id, username, display_name, bio, created_at, updated_at, status",
          { count: "exact", head }
        ),
    memberColumns,
    query,
    ["id"],
    "Failed to load the members table."
  );

  const data = (rows ?? []).map((row) => ({
    id: row.id!,
    username: row.username!,
    display_name: row.display_name,
    bio: row.bio,
    date_created: row.created_at!,
    date_updated: row.updated_at!,
    status: row.status ?? undefined,
  }));

  return { data, total };
}

// get one page of the assignments table
export async function fetchAssignmentsTable(
  supabase: DB,
  query: AssignmentsTableQuery
) {
  const { rows, total } = await fetchTablePage(
    ({ head }) =>
      supabase.from("dashboard_assignments").select("*", {
        count: "exact",
        head,
      }),
    assignmentColumns,
    query,
    ["panel_id", "member_id"],
    "Failed to load the assignments table."
  );

  const data = (rows ?? []).map((row) => ({
    id: row.member_id,
    panel_id: row.panel_id!,
    username: row.username ?? undefined,
    type: row.case_type!,
    title: row.title!,
    date_created: row.created_at!,
    date_updated: row.updated_at!,
    change_summary: row.change_summary!,
    status: row.status!,
    user_status: row.member_status ?? undefined,
    time_left: row.expires_at,
  }));

  return { data, total };
}

// suspend a user
export async function suspendUser(supabase: DB, userId: string) {
  await markUserStatus(supabase, userId, "suspended");
}

// unsuspend a user
export async function unsuspendUser(supabase: DB, userId: string) {
  await markUserStatus(supabase, userId, "active");
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

// One page of role applications. The view carries the table's RLS, so an
// admin sees every application and anyone else only their own.
export async function fetchRoleApplicationsTable(
  supabase: DB,
  query: RoleApplicationsTableQuery
) {
  const { rows, total } = await fetchTablePage(
    ({ head }) =>
      supabase
        .from("dashboard_role_applications")
        .select(
          "id, user_id, username, role, status, statement, created_at, decided_at, decided_by",
          { count: "exact", head }
        ),
    roleApplicationColumns,
    query,
    ["id"],
    "Failed to load the role applications table."
  );

  const data = (rows ?? []).map((row) => ({
    id: row.id!,
    user_id: row.user_id!,
    username: row.username!,
    role: row.role!,
    status: row.status!,
    statement: row.statement,
    date_created: row.created_at!,
    date_decided: row.decided_at,
    decided_by: row.decided_by,
  }));

  return { data, total };
}

// Approve or reject a pending application. Approval grants the role inside
// the same transaction (decide_role_application).
export async function decideRoleApplication(
  supabase: DB,
  applicationId: string,
  decision: RoleApplicationDecision
) {
  const { data, error } = await supabase.rpc("decide_role_application", {
    p_application_id: applicationId,
    p_decision: decision,
  });

  if (error) {
    if (error.code === "42501")
      throw new ServiceError("Only admins can decide role applications", 403);
    if (error.code === "P0002")
      throw new ServiceError(
        "Role application not found or already decided",
        404
      );
    console.error(error);
    throw new ServiceError("Failed to decide role application", 500);
  }

  return {
    application: {
      id: data.id,
      role: data.role,
      status: data.status,
      statement: data.statement,
      created_at: data.created_at,
      decided_at: data.decided_at,
    },
  };
}
