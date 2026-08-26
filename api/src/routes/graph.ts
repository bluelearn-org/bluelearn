import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { z } from "zod";
import { requireUser } from "../middleware/auth.middleware";
import { rateLimitMiddleware } from "../middleware/rate-limit.middleware";
import { CONTRIBUTION } from "../middleware/rateLimits";
import type { HonoEnv } from "../types";
import {
  createPrerequisiteSchema,
  createTodoPrerequisiteSchema,
  prerequisiteResponseSchema,
  todoListResponseSchema,
  todoResponseSchema,
} from "@bluelearn/schemas";
import { errorResponses, jsonContent, validate } from "../lib/openapi";
import {
  createPrerequisite,
  suspendPrerequisite,
} from "../services/prerequisite.service";
import { createTodo, listOpenTodos } from "../services/todo.service";

const idParamSchema = z.object({ id: z.uuid() });

export const prerequisitesRouter = new Hono<HonoEnv>()
  // 201 with { edge }. 409 on duplicate/cycle, 422 on self-loop.
  .post(
    "/",
    describeRoute({
      tags: ["graph"],
      summary: "Add a prerequisite edge",
      security: [{ bearerAuth: [] }],
      responses: {
        201: jsonContent(prerequisiteResponseSchema, "The created edge"),
        ...errorResponses(400, 401, 404, 409, 422, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...CONTRIBUTION, bucket: "prerequisite-create" }),
    validate("json", createPrerequisiteSchema),
    async (c) => {
      const { from_guide_base_id, to_guide_base_id } = c.req.valid("json");
      const edge = await createPrerequisite(
        c.get("supabase"),
        from_guide_base_id,
        to_guide_base_id
      );
      return c.json({ edge }, 201);
    }
  )

  // Suspends the edge; returns { edge }. 404 if missing.
  .delete(
    "/:id",
    describeRoute({
      tags: ["graph"],
      summary: "Suspend a prerequisite edge",
      security: [{ bearerAuth: [] }],
      responses: {
        200: jsonContent(prerequisiteResponseSchema, "The suspended edge"),
        ...errorResponses(401, 404, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...CONTRIBUTION, bucket: "prerequisite-suspend" }),
    validate("param", idParamSchema),
    async (c) => {
      const edge = await suspendPrerequisite(
        c.get("supabase"),
        c.req.valid("param").id
      );
      return c.json({ edge }, 200);
    }
  );

export const todosRouter = new Hono<HonoEnv>()
  // Returns open todo prerequisites as { todos }.
  .get(
    "/",
    describeRoute({
      tags: ["graph"],
      summary: "List open todo prerequisites",
      responses: {
        200: jsonContent(todoListResponseSchema, "Open todo prerequisites"),
      },
    }),
    async (c) => {
      const todos = await listOpenTodos(c.get("supabase"));
      return c.json({ todos }, 200);
    }
  )

  // 201 with { todo }.
  .post(
    "/",
    describeRoute({
      tags: ["graph"],
      summary: "Declare a todo prerequisite",
      security: [{ bearerAuth: [] }],
      responses: {
        201: jsonContent(todoResponseSchema, "The created todo prerequisite"),
        ...errorResponses(400, 401, 404, 429),
      },
    }),
    requireUser,
    rateLimitMiddleware({ ...CONTRIBUTION, bucket: "todo-create" }),
    validate("json", createTodoPrerequisiteSchema),
    async (c) => {
      const { guide_base_id, title, summary } = c.req.valid("json");
      const todo = await createTodo(
        c.get("supabase"),
        guide_base_id,
        title,
        summary
      );
      return c.json({ todo }, 201);
    }
  );
