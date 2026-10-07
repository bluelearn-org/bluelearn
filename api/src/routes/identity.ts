import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { z } from "zod";
import {
  createRoleApplicationSchema,
  meResponseSchema,
  myDraftsResponseSchema,
  myRoleApplicationsResponseSchema,
  profilePageResponseSchema,
  roleApplicationResponseSchema,
  updateProfileSchema,
} from "@bluelearn/schemas";
import { errorResponses, jsonContent, validate } from "../lib/openapi";
import {
  getAuthenticatedUser,
  getServiceSupabase,
  requireUser,
} from "../middleware/auth.middleware";
import { rateLimitMiddleware } from "../middleware/rate-limit.middleware";
import { CONTRIBUTION, CREATE, DESTRUCTIVE } from "../middleware/rateLimits";
import type { HonoEnv } from "../types";
import {
  applyForRole,
  deleteMyAccount,
  getMyDrafts,
  getMyIdentity,
  getProfilePage,
  listMyRoleApplications,
  updateMyProfile,
} from "../services/identity.service";

const usernameParamSchema = z.object({ username: z.string() });

export const meRouter = new Hono<HonoEnv>()
  // Returns the caller's profile, email, and roles. 404 if no profile row.
  .get(
    "/",
    describeRoute({
      tags: ["identity"],
      summary: "Own profile + roles",
      security: [{ bearerAuth: [] }],
      responses: {
        200: jsonContent(meResponseSchema, "The caller's profile and roles"),
        ...errorResponses(401, 404),
      },
    }),
    requireUser,
    async (c) => {
      const user = c.get("user");
      const { profile, roles } = await getMyIdentity(
        c.get("supabase"),
        user.id
      );
      c.header("Cache-Control", "no-store");
      return c.json({ profile, email: user.email ?? null, roles });
    }
  )

  // Lists the caller's own draft revisions (guides + objectives), newest first, for
  // a "continue editing" view. Drafts are absent from public listings, so this
  // is the way back in. Keyed on revision id since an unpublished shell has no slug.
  .get(
    "/drafts",
    describeRoute({
      tags: ["identity"],
      summary: "The caller's in-progress drafts",
      security: [{ bearerAuth: [] }],
      responses: {
        200: jsonContent(
          myDraftsResponseSchema,
          "The caller's guide and objective draft revisions"
        ),
        ...errorResponses(401),
      },
    }),
    requireUser,
    async (c) => {
      const drafts = await getMyDrafts(c.get("supabase"), c.get("user").id);
      return c.json(drafts);
    }
  )

  // The caller's role applications, newest first.
  .get(
    "/role-applications",
    describeRoute({
      tags: ["identity"],
      summary: "The caller's role applications",
      security: [{ bearerAuth: [] }],
      responses: {
        200: jsonContent(
          myRoleApplicationsResponseSchema,
          "Every application the caller has filed, newest first"
        ),
        ...errorResponses(401),
      },
    }),
    requireUser,
    async (c) => {
      const applications = await listMyRoleApplications(
        c.get("supabase"),
        c.get("user").id
      );
      return c.json(applications);
    }
  )

  // Applies for verifier or moderator. 409 when the caller already holds the
  // role or has an open application for it; 403 for suspended accounts.
  .post(
    "/role-applications",
    describeRoute({
      tags: ["identity"],
      summary: "Apply for a role",
      security: [{ bearerAuth: [] }],
      responses: {
        201: jsonContent(
          roleApplicationResponseSchema,
          "The pending application"
        ),
        ...errorResponses(400, 401, 403, 409, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...CREATE, bucket: "role-application" }),
    validate("json", createRoleApplicationSchema),
    async (c) => {
      const application = await applyForRole(
        c.get("supabase"),
        c.get("user").id,
        c.req.valid("json")
      );
      return c.json(application, 201);
    }
  )

  // Updates the caller's profile. 409 if the username is taken.
  .patch(
    "/",
    describeRoute({
      tags: ["identity"],
      summary: "Update own profile",
      security: [{ bearerAuth: [] }],
      responses: {
        200: jsonContent(meResponseSchema, "The updated profile and roles"),
        ...errorResponses(400, 401, 409, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...CONTRIBUTION, bucket: "profile-update" }),
    validate("json", updateProfileSchema),
    async (c) => {
      const user = c.get("user");
      const { profile, roles } = await updateMyProfile(
        c.get("supabase"),
        user.id,
        c.req.valid("json")
      );
      return c.json({ profile, email: user.email ?? null, roles });
    }
  )

  // Permanently deletes the caller's account. Authored work is anonymized rather
  // than removed. The client still holds a session, so it should sign out after.
  .delete(
    "/",
    describeRoute({
      tags: ["identity"],
      summary: "Delete own account",
      security: [{ bearerAuth: [] }],
      responses: {
        204: { description: "The account was deleted" },
        ...errorResponses(401, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...DESTRUCTIVE, bucket: "account-delete" }),
    async (c) => {
      await deleteMyAccount(getServiceSupabase(c), c.get("user").id);
      return c.body(null, 204);
    }
  );

export const profilesRouter = new Hono<HonoEnv>()
  // Returns a profile, badges, stats, and activity by username. Drafts and
  // in-flight work are only in the payload when the caller owns the profile.
  // 404 if missing or suspended.
  .get(
    "/:username",
    describeRoute({
      tags: ["identity"],
      summary: "Public profile by username",
      responses: {
        200: jsonContent(
          profilePageResponseSchema,
          "The public profile, badges, stats, and activity"
        ),
        ...errorResponses(404),
      },
    }),
    validate("param", usernameParamSchema),
    async (c) => {
      const { user } = await getAuthenticatedUser(c);
      const page = await getProfilePage(
        c.get("supabase"),
        getServiceSupabase(c),
        c.req.valid("param").username,
        user?.id ?? null
      );
      return c.json(page);
    }
  );
