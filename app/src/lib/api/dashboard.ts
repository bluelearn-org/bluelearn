import { toast } from "sonner";
import type { InferRequestType, InferResponseType } from "hono/client";
import { client } from "@/lib/api/apiClient";
import { assertOk } from "@/lib/api/apiHelpers";

const dashboard = client.dashboard;

type FetchOptions = { signal?: AbortSignal };

type TableQuery = Record<string, string | Array<string>>;

export type UserStatus = InferRequestType<
  (typeof dashboard)[":id"]["status"]["$patch"]
>["json"]["status"];
export type UserRole = InferRequestType<
  (typeof dashboard)[":id"]["role"][":roleName"]["$post"]
>["param"]["roleName"];
export type DashboardRoleRow = InferResponseType<
  (typeof dashboard)["roles"]["$get"]
>["data"];
export type MemberRow = InferResponseType<
  (typeof dashboard)["members"]["$get"]
>["data"][number];
export type AssignmentTable = InferResponseType<
  (typeof dashboard)["assignments"]["$get"]
>["data"];
export type RoleApplicationRow = InferResponseType<
  (typeof dashboard)["role-applications"]["$get"],
  200
>["data"][number];
export type RoleApplicationDecision = InferRequestType<
  (typeof dashboard)["role-applications"][":id"]["$patch"]
>["json"]["status"];

// Get a user's current status
export async function getUserStatus(id: string, { signal }: FetchOptions = {}) {
  const res = await dashboard[":id"].status.$get(
    { param: { id } },
    { init: { signal } }
  );

  await assertOk(res);
  const { status } = await res.json();

  return status;
}

// toggle user status between active and inactive
export async function toggleAFK(
  id: string,
  status: UserStatus,
  { signal }: FetchOptions = {}
) {
  if (status == "suspended") {
    toast.error("Cannot mark suspended user as AFK.");
    return;
  }

  const newStatus = status == "active" ? "inactive" : "active";

  const res = await dashboard[":id"].status.$patch(
    {
      json: { status: newStatus },
      param: { id },
    },
    { init: { signal } }
  );

  await assertOk(res);
}

// Change users status
export async function setUserStatus(
  id: string,
  status: UserStatus,
  { signal }: FetchOptions = {}
) {
  const res = await dashboard[":id"].status.$patch(
    {
      json: { status },
      param: { id },
    },
    { init: { signal } }
  );

  await assertOk(res);
  const { data: newStatus } = await res.json();

  return newStatus;
}

// Add role to a user
export async function addRole(
  id: string,
  role: UserRole,
  { signal }: FetchOptions = {}
) {
  const res = await dashboard[":id"].role[":roleName"].$post(
    {
      param: { id, roleName: role },
    },
    { init: { signal } }
  );

  await assertOk(res);
}

// Remove role from a user
export async function removeRole(
  id: string,
  role: UserRole,
  { signal }: FetchOptions = {}
) {
  const res = await dashboard[":id"].role[":roleName"].$delete(
    {
      param: { id, roleName: role },
    },
    { init: { signal } }
  );

  await assertOk(res);
}

// List one page of role data for users
export async function fetchRoleTable(
  query: TableQuery,
  { signal }: FetchOptions = {}
) {
  const res = await dashboard.roles.$get({ query }, { init: { signal } });

  await assertOk(res);
  return res.json();
}

// List one page of member/profile data
export async function fetchMembersTable(
  query: TableQuery,
  { signal }: FetchOptions = {}
) {
  const res = await dashboard.members.$get({ query }, { init: { signal } });

  await assertOk(res);
  return res.json();
}

// Get one page of data for the assignments table
export async function fetchAssignmentsTable(
  query: TableQuery,
  { signal }: FetchOptions = {}
) {
  const res = await dashboard.assignments.$get({ query }, { init: { signal } });

  await assertOk(res);
  return res.json();
}

// Mark user as suspended
export async function suspendUser(id: string, { signal }: FetchOptions = {}) {
  const res = await dashboard[":id"].suspend.$patch(
    { param: { id } },
    { init: { signal } }
  );

  await assertOk(res);
}

// Mark user as unsuspended
export async function unsuspendUser(id: string, { signal }: FetchOptions = {}) {
  const res = await dashboard[":id"].unsuspend.$patch(
    { param: { id } },
    { init: { signal } }
  );

  await assertOk(res);
}

// Reassign a panel member
export async function reassignPanelMember(
  id: string,
  panel_id: string,
  { signal }: FetchOptions = {}
) {
  const res = await dashboard[":id"].reassign[":panel_id"].$patch(
    { param: { id, panel_id } },
    { init: { signal } }
  );

  await assertOk(res);
}

// Get one page of data for the role applications table
export async function fetchRoleApplicationsTable(
  query: TableQuery,
  { signal }: FetchOptions = {}
) {
  const res = await dashboard["role-applications"].$get(
    { query },
    { init: { signal } }
  );

  await assertOk(res);
  return res.json();
}

// Approve or reject a pending role application; approval grants the role
export async function decideRoleApplication(
  id: string,
  status: RoleApplicationDecision,
  { signal }: FetchOptions = {}
) {
  const res = await dashboard["role-applications"][":id"].$patch(
    { param: { id }, json: { status } },
    { init: { signal } }
  );

  await assertOk(res);
}
