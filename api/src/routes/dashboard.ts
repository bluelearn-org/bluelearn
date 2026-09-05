import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
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
} from "../services/dashboard.service";
import { jsonContent, errorResponses, validate } from "../lib/openapi";
import {
  updateStatusSchema,
  roleParamSchema,
  idParamSchema,
  reassignParamSchema,
  successResponseSchema,
  userStatusResponseSchema,
  updateStatusResponseSchema,
  rolesTableResponseSchema,
  membersTableResponseSchema,
  assignmentsTableResponseSchema,
} from "@bluelearn/schemas";

export const dashboardRouter = new Hono<HonoEnv>()
  // Get user status (Active, Inactive, Suspended)
  .get(
    "/:id/status",
    describeRoute({
      tags: ["dashboard"],
      summary: "View user status",
      responses: {
        200: jsonContent(userStatusResponseSchema, "User's status"),
        ...errorResponses(400, 404),
      },
    }),
    validate("param", idParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const status = await getUserStatus(c.get("supabase"), id);
      return c.json({ status }, 200);
    }
  )

  // Change users status
  .patch(
    "/:id/status",
    describeRoute({
      tags: ["dashboard"],
      summary: "Change user status",
      responses: {
        200: jsonContent(updateStatusResponseSchema, "User's status"),
        ...errorResponses(400, 401, 404),
      },
    }),
    requireUser,
    validate("param", idParamSchema),
    validate("json", updateStatusSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const { status } = c.req.valid("json");
      const data = await markUserStatus(c.get("supabase"), id, status);
      return c.json({ data }, 200);
    }
  )

  // Add role to user
  .post(
    "/:id/role/:roleName",
    describeRoute({
      tags: ["dashboard"],
      summary: "Add role to user",
      responses: {
        200: jsonContent(successResponseSchema, "Successfully added role"),
        ...errorResponses(400, 401),
      },
    }),
    validate("param", roleParamSchema),
    requireUser,
    async (c) => {
      const { id, roleName } = c.req.valid("param");
      await addRole(c.get("supabase"), id, roleName);
      return c.json({ success: true }, 200);
    }
  )

  // Remove role from user
  .delete(
    "/:id/role/:roleName",
    describeRoute({
      tags: ["dashboard"],
      summary: "Remove role from user",
      responses: {
        200: jsonContent(successResponseSchema, "Successfully deleted role"),
        ...errorResponses(400, 401),
      },
    }),
    requireUser,
    validate("param", roleParamSchema),
    async (c) => {
      const { id, roleName } = c.req.valid("param");
      await removeRole(c.get("supabase"), id, roleName);
      return c.json({ success: true }, 200);
    }
  )

  // Fetch roles table
  .get(
    "/roles",
    describeRoute({
      tags: ["dashboard"],
      summary: "Fetch table of user roles",
      responses: {
        200: jsonContent(rolesTableResponseSchema, "Table of user role data"),
        ...errorResponses(400, 401),
      },
    }),
    requireUser,
    async (c) => {
      const data = await fetchRolesTable(c.get("supabase"));
      return c.json({ data }, 200);
    }
  )

  // Fetch members table
  .get(
    "/members",
    describeRoute({
      tags: ["dashboard"],
      summary: "Fetch table with information about members",
      responses: {
        200: jsonContent(membersTableResponseSchema, "Table of member data"),
        ...errorResponses(400, 401),
      },
    }),
    requireUser,
    async (c) => {
      const data = await fetchMembersTable(c.get("supabase"));
      return c.json({ data }, 200);
    }
  )

  // Fetch assignments table
  .get(
    "/assignments",
    describeRoute({
      tags: ["dashboard"],
      summary: "Fetch table with verifier assignments",
      responses: {
        200: jsonContent(
          assignmentsTableResponseSchema,
          "Table of verifier assignment data"
        ),
        ...errorResponses(400, 401),
      },
    }),
    requireUser,
    async (c) => {
      const data = await fetchAssignmentsTable(c.get("supabase"));
      return c.json({ data }, 200);
    }
  )

  // Suspend user
  .patch(
    "/:id/suspend",
    describeRoute({
      tags: ["dashboard"],
      summary: "Suspend a user",
      responses: {
        200: jsonContent(successResponseSchema, "User suspended successfully"),
        ...errorResponses(400, 401, 404),
      },
    }),
    requireUser,
    validate("param", idParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      await suspendUser(c.get("supabase"), id);
      return c.json({ success: true }, 200);
    }
  )

  // Unsuspend user
  .patch(
    "/:id/unsuspend",
    describeRoute({
      tags: ["dashboard"],
      summary: "Unsuspend a user",
      responses: {
        200: jsonContent(
          successResponseSchema,
          "User unsuspended successfully"
        ),
        ...errorResponses(400, 401, 404),
      },
    }),
    requireUser,
    validate("param", idParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      await unsuspendUser(c.get("supabase"), id);
      return c.json({ success: true }, 200);
    }
  )

  // Reassign a panel member
  .patch(
    "/:id/reassign/:panel_id",
    describeRoute({
      tags: ["dashboard"],
      summary: "Reassign panel member",
      responses: {
        200: jsonContent(
          successResponseSchema,
          "Panel member successfully reassigned"
        ),
        ...errorResponses(400, 401, 404),
      },
    }),
    requireUser,
    validate("param", reassignParamSchema),
    async (c) => {
      const { id, panel_id } = c.req.valid("param");
      await reassignPanelMember(c.get("supabase"), id, panel_id);
      return c.json({ success: true }, 200);
    }
  );
