import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { HonoEnv } from "../types";
import { requireUser } from "../middleware/auth.middleware";
import {
  getUserStatus,
  markUserStatus,
  suspendUser,
  unsuspendUser,
  addRole,
  removeRole,
  fetchRolesTable,
  fetchMembersTable,
  fetchAssignmentsTable,
  reassignPanelMember,
  updateStatusSchema,
  updateRoleSchema,
  roleParamSchema,
} from "../services/dashboard.service";

export const dashboardRouter = new Hono<HonoEnv>()
  .use("*", requireUser)
  // Get user status (Active, Inactive, Suspended)
  .get("/:id/status", async (c) => {
    const { id } = c.req.param();
    const status = await getUserStatus(c.get("supabase"), id);
    return c.json({ status }, 200);
  })

  // Change users status
  .patch("/:id/status", zValidator("json", updateStatusSchema), async (c) => {
    const { id: userId } = c.req.param();
    const { status } = c.req.valid("json");
    const data = await markUserStatus(c.get("supabase"), userId, status);
    return c.json({ data }, 200);
  })

  // Add role to user
  .post("/:id/role", zValidator("json", updateRoleSchema), async (c) => {
    const { id: userId } = c.req.param();
    const { role } = c.req.valid("json");
    await addRole(c.get("supabase"), userId, role);
    return c.json({ success: true }, 200);
  })

  // Remove role from user
  .delete(
    "/:id/role/:roleName",
    zValidator("param", roleParamSchema),
    async (c) => {
      const { id, roleName } = c.req.valid("param");
      await removeRole(c.get("supabase"), id, roleName);
      return c.json({ success: true }, 200);
    }
  )

  // Fetch roles table
  .get("/roles", async (c) => {
    const data = await fetchRolesTable(c.get("supabase"));
    return c.json({ data }, 200);
  })

  // Fetch members table
  .get("/members", async (c) => {
    const data = await fetchMembersTable(c.get("supabase"));
    return c.json({ data }, 200);
  })

  // Fetch assignments table
  .get("/assignments", async (c) => {
    const data = await fetchAssignmentsTable(c.get("supabase"));
    return c.json({ data }, 200);
  })

  // Suspend user
  .patch("/:id/suspend", async (c) => {
    const { id } = c.req.param();
    await suspendUser(c.get("supabase"), id);
    return c.json({ success: true }, 200);
  })

  // Unsuspend user
  .patch("/:id/unsuspend", async (c) => {
    const { id } = c.req.param();
    await unsuspendUser(c.get("supabase"), id);
    return c.json({ success: true }, 200);
  })

  // Reassign a panel member
  .patch("/:id/reassign/:panel_id", async (c) => {
    const { id, panel_id } = c.req.param();
    await reassignPanelMember(c.get("supabase"), id, panel_id);
    return c.json({ success: true }, 200);
  });
