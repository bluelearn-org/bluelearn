import { describe, it, expect } from "vitest";
import app from "../src/index";
import { auth, env, jsonAuth, makeUser } from "./helpers";
import { grantRole } from "./factories/identity";
import { createGuideBase, createGuide } from "./factories/guides";
import { createPrerequisite, createTodo } from "./factories/graph";
import { expectToMatchSpec } from "./openapi";

// Two published bases where `userId` authors a guide under the first, which is
// what the edge/todo insert policies key on.
async function seedAuthoredBases(userId: string) {
  const from = await createGuideBase({ status: "published" });
  const to = await createGuideBase({ status: "published" });
  await createGuide(from.id, { author_id: userId });
  return { from, to };
}

describe("POST /prerequisites", () => {
  it("401s without a token", async () => {
    const res = await app.request("/prerequisites", { method: "POST" }, env);
    expect(res.status).toBe(401);
    await expectToMatchSpec(res, "POST", "/prerequisites");
  });

  it("creates an edge for an author of a touched base", async () => {
    const { token, userId } = await makeUser();
    const { from, to } = await seedAuthoredBases(userId);

    const res = await app.request(
      "/prerequisites",
      jsonAuth(token, "POST", {
        from_guide_base_id: from.id,
        to_guide_base_id: to.id,
      }),
      env
    );

    expect(res.status).toBe(201);
    await expectToMatchSpec(res, "POST", "/prerequisites");
    const body = (await res.json()) as {
      edge: { from_guide_base_id: string; to_guide_base_id: string };
    };
    expect(body.edge.from_guide_base_id).toBe(from.id);
    expect(body.edge.to_guide_base_id).toBe(to.id);
  });

  it("409s when the edge would close a cycle", async () => {
    const { token, userId } = await makeUser();
    const { from, to } = await seedAuthoredBases(userId);
    await createPrerequisite(from.id, to.id);

    const res = await app.request(
      "/prerequisites",
      jsonAuth(token, "POST", {
        from_guide_base_id: to.id,
        to_guide_base_id: from.id,
      }),
      env
    );

    expect(res.status).toBe(409);
    await expectToMatchSpec(res, "POST", "/prerequisites");
  });
});

describe("DELETE /prerequisites/{id}", () => {
  it("suspends the edge for a moderator", async () => {
    const { token, userId } = await makeUser();
    await grantRole(userId, "moderator");
    const { from, to } = await seedAuthoredBases(userId);
    const edge = await createPrerequisite(from.id, to.id);

    const res = await app.request(
      `/prerequisites/${edge.id}`,
      { method: "DELETE", ...auth(token) },
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "DELETE", "/prerequisites/{id}");
    const body = (await res.json()) as { edge: { is_suspended: boolean } };
    expect(body.edge.is_suspended).toBe(true);
  });

  it("404s for a non-moderator", async () => {
    const { token, userId } = await makeUser();
    const { from, to } = await seedAuthoredBases(userId);
    const edge = await createPrerequisite(from.id, to.id);

    const res = await app.request(
      `/prerequisites/${edge.id}`,
      { method: "DELETE", ...auth(token) },
      env
    );

    expect(res.status).toBe(404);
    await expectToMatchSpec(res, "DELETE", "/prerequisites/{id}");
  });
});

describe("GET /todos", () => {
  it("lists open todos and omits resolved ones", async () => {
    const { userId } = await makeUser();
    const { from, to } = await seedAuthoredBases(userId);
    const open = await createTodo(from.id);
    const resolved = await createTodo(from.id, {
      status: "resolved",
      resolved_guide_base_id: to.id,
    });

    const res = await app.request("/todos", {}, env);

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/todos");
    const body = (await res.json()) as { todos: Array<{ id: string }> };
    const ids = body.todos.map((t) => t.id);
    expect(ids).toContain(open.id);
    expect(ids).not.toContain(resolved.id);
  });
});

describe("POST /todos", () => {
  it("401s without a token", async () => {
    const res = await app.request("/todos", { method: "POST" }, env);
    expect(res.status).toBe(401);
    await expectToMatchSpec(res, "POST", "/todos");
  });

  it("creates a todo for an author of the dependent base", async () => {
    const { token, userId } = await makeUser();
    const { from } = await seedAuthoredBases(userId);

    const res = await app.request(
      "/todos",
      jsonAuth(token, "POST", {
        guide_base_id: from.id,
        title: "Needs intro to limits",
      }),
      env
    );

    expect(res.status).toBe(201);
    await expectToMatchSpec(res, "POST", "/todos");
    const body = (await res.json()) as {
      todo: { title: string; status: string };
    };
    expect(body.todo.title).toBe("Needs intro to limits");
    expect(body.todo.status).toBe("open");
  });
});
