import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireUser } from "../middleware/auth.middleware";
import type { HonoEnv } from "../types";
import {
  createPrerequisiteSchema,
  createTodoPrerequisiteSchema,
} from "@bluelearn/schemas";
import {
  createPrerequisite,
  suspendPrerequisite,
} from "../services/prerequisite.service";
import { createTodo, listOpenTodos } from "../services/todo.service";

export const prerequisitesRouter = new Hono<HonoEnv>()
  // 201 with { edge }. 409 on duplicate/cycle, 422 on self-loop.
  .post(
    "/",
    requireUser,
    zValidator("json", createPrerequisiteSchema),
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
  .delete("/:id", requireUser, async (c) => {
    const edge = await suspendPrerequisite(
      c.get("supabase"),
      c.req.param("id")
    );
    return c.json({ edge }, 200);
  });

export const todosRouter = new Hono<HonoEnv>()
  // Returns open todo prerequisites as { todos }.
  .get("/", async (c) => {
    const todos = await listOpenTodos(c.get("supabase"));
    return c.json({ todos }, 200);
  })

  // 201 with { todo }.
  .post(
    "/",
    requireUser,
    zValidator("json", createTodoPrerequisiteSchema),
    async (c) => {
      const { guide_base_id, title } = c.req.valid("json");
      const todo = await createTodo(c.get("supabase"), guide_base_id, title);
      return c.json({ todo }, 201);
    }
  );
