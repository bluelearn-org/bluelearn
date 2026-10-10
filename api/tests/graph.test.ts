import { describe, it, expect } from "vitest";
import app from "../src/index";
import { admin, auth, env, insert, jsonAuth, makeUser } from "./helpers";
import { grantRole } from "./factories/identity";
import { createGuideBase, createGuide } from "./factories/guides";
import { createPrerequisite, createTodo } from "./factories/graph";
import { expectToMatchSpec } from "./openapi";
import { createRequestSchema } from "@bluelearn/schemas";

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

  it("lists standalone requests and hides requests for unpublished bases", async () => {
    const standalone = await insert("requests", {
      dependent_guide_base_id: null,
      title: "Standalone guide request",
      summary: "A guide that is useful without a parent topic",
      status: "open",
    });
    const draftBase = await createGuideBase({ status: "draft" });
    const unpublished = await createTodo(draftBase.id);

    const res = await app.request("/todos", {}, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      todos: Array<{ id: string; guide_base_id: string | null }>;
    };
    const listed = body.todos.find((todo) => todo.id === standalone.id);
    expect(listed?.guide_base_id).toBeNull();
    expect(body.todos.map((todo) => todo.id)).not.toContain(unpublished.id);
  });

  it("resolves a claimed standalone request without creating an edge", async () => {
    const source = await createGuideBase({ status: "published" });
    const standalone = await insert("requests", {
      dependent_guide_base_id: null,
      title: "Standalone guide request",
      summary: "A guide that is useful without a parent topic",
      status: "open",
    });
    await insert("request_claims", {
      todo_id: standalone.id,
      guide_base_id: source.id,
    });

    const { error } = await admin
      .from("requests")
      .update({ status: "resolved", resolved_guide_base_id: source.id })
      .eq("id", standalone.id);

    expect(error).toBeNull();
    const { data: edges, error: edgeError } = await admin
      .from("guide_edges")
      .select("id")
      .eq("from_guide_base_id", source.id);
    expect(edgeError).toBeNull();
    expect(edges).toHaveLength(0);
  });
});

describe("POST /todos", () => {
  it.each([
    { title: " \t\n", summary: "Summary" },
    { title: "x".repeat(51), summary: "Summary" },
    { title: "Title", summary: "x".repeat(501) },
  ])(
    "enforces standalone content constraints for direct inserts: %j",
    async (content) => {
      const { error } = await admin.from("requests").insert({
        dependent_guide_base_id: null,
        ...content,
      });

      expect(error?.code).toBe("23514");
    }
  );

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
        summary: "Explains limits before continuity is introduced",
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

  it("creates a standalone request when no guide base is supplied", async () => {
    const { token } = await makeUser();

    const res = await app.request(
      "/todos",
      jsonAuth(token, "POST", {
        title: "Standalone guide request",
        summary: "A guide that is useful without a parent topic",
      }),
      env
    );

    expect(res.status).toBe(201);
    await expectToMatchSpec(res, "POST", "/todos");
    const body = (await res.json()) as {
      todo: { guide_base_id: string | null };
    };
    expect(body.todo.guide_base_id).toBeNull();
  });

  it("uses the shared request title and summary limits", () => {
    expect(
      createRequestSchema.safeParse({
        title: "A valid request",
        summary: "",
      }).success
    ).toBe(true);
    expect(
      createRequestSchema.safeParse({
        title: "x".repeat(51),
        summary: "summary",
      }).success
    ).toBe(false);
    expect(
      createRequestSchema.safeParse({
        title: "Valid title",
        summary: "x".repeat(501),
      }).success
    ).toBe(false);
  });
});
