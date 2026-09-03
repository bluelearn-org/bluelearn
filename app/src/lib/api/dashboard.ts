import { toast } from "sonner";
import type { InferRequestType, InferResponseType } from "hono/client";
import { client } from "@/lib/api/apiClient";
import { assertOk } from "@/lib/api/apiHelpers";

const dashboard = client.dashboard;

type FetchOptions = { signal?: AbortSignal };

export type UserStatus = InferRequestType<
  (typeof dashboard)[":id"]["status"]["$patch"]
>["json"]["status"];
export type UserRole = InferRequestType<
  (typeof dashboard)[":id"]["role"]["$post"]
>["json"]["role"];
export type DashboardRoleRow = InferResponseType<
  (typeof dashboard)["roles"]["$get"]
>["data"];
export type MemberRow = InferResponseType<
  (typeof dashboard)["members"]["$get"]
>["data"][number];
export type AssignmentTable = InferResponseType<
  (typeof dashboard)["assignments"]["$get"]
>["data"];

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

// toggle user status from active to inactive
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
  const res = await dashboard[":id"].role.$post(
    {
      json: { role },
      param: { id },
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

// List role data for every user
export async function fetchRoleTable({ signal }: FetchOptions = {}) {
  const res = await dashboard.roles.$get({ init: { signal } });

  await assertOk(res);
  const { data: roleTable } = await res.json();

  return roleTable;
}

// List member/profile data for every user
export async function fetchMembersTable({ signal }: FetchOptions = {}) {
  const res = await dashboard.members.$get({ init: { signal } });

  await assertOk(res);
  const { data: memberTable } = await res.json();

  return memberTable;
}

// Get data for assignments table
export async function fetchAssignmentsTable({ signal }: FetchOptions = {}) {
  const res = await dashboard.assignments.$get({ init: { signal } });

  await assertOk(res);
  const { data: assignmentTable } = await res.json();

  return assignmentTable;
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
