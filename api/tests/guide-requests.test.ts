import { describe, expect, it, vi } from "vitest";
import { createRequestSchema } from "@bluelearn/schemas";
import { ServiceError } from "../src/lib/service-error";
import { createTodo, listOpenTodos } from "../src/services/todo.service";

const publishedBaseId = "00000000-0000-4000-8000-000000000001";

function listSupabase(rows: unknown[], error: unknown = null) {
  const result = { data: rows, error };
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    or: vi.fn(async () => result),
  };
  return {
    client: { from: vi.fn(() => query) },
    query,
  };
}

describe("createRequestSchema", () => {
  it("trims content, accepts an omitted parent, and allows an empty summary", () => {
    const parsed = createRequestSchema.parse({
      title: "  A standalone request  ",
      summary: "   ",
    });

    expect(parsed).toEqual({
      title: "A standalone request",
      summary: "",
    });
  });

  it("accepts the shared title and summary maximums", () => {
    expect(
      createRequestSchema.safeParse({
        title: "x".repeat(50),
        summary: "x".repeat(500),
      }).success
    ).toBe(true);
  });

  it("rejects blank titles, oversized content, and invalid parents", () => {
    expect(
      createRequestSchema.safeParse({ title: "   ", summary: "summary" })
        .success
    ).toBe(false);
    expect(
      createRequestSchema.safeParse({
        title: "x".repeat(51),
        summary: "summary",
      }).success
    ).toBe(false);
    expect(
      createRequestSchema.safeParse({
        title: "Title",
        summary: "x".repeat(501),
      }).success
    ).toBe(false);
    expect(
      createRequestSchema.safeParse({
        guide_base_id: "not-a-uuid",
        title: "Title",
        summary: "summary",
      }).success
    ).toBe(false);
  });
});

describe("listOpenTodos", () => {
  it("keeps standalone and published-parent rows only", async () => {
    const { client, query } = listSupabase([
      {
        id: "request-standalone",
        dependent_guide_base_id: null,
        title: "Standalone",
        summary: "Summary",
        status: "open",
        created_at: "2026-09-20T00:00:00.000Z",
        claims: [{ count: 1 }],
        base: null,
      },
      {
        id: "request-published",
        dependent_guide_base_id: publishedBaseId,
        title: "Published parent",
        summary: "Summary",
        status: "open",
        created_at: "2026-09-20T00:00:00.000Z",
        claims: [{ count: 2 }],
        base: {
          status: "published",
          slug: "published-parent",
          canonical: { current: { title: "Published Parent" } },
        },
      },
      {
        id: "request-draft",
        dependent_guide_base_id: "00000000-0000-4000-8000-000000000002",
        title: "Draft parent",
        summary: "Hidden",
        status: "open",
        created_at: "2026-09-20T00:00:00.000Z",
        claims: [{ count: 0 }],
        base: { status: "draft", slug: "draft-parent", canonical: null },
      },
      {
        id: "request-missing-parent",
        dependent_guide_base_id: "00000000-0000-4000-8000-000000000003",
        title: "Missing parent",
        summary: "Hidden",
        status: "open",
        created_at: "2026-09-20T00:00:00.000Z",
        claims: [{ count: 0 }],
        base: null,
      },
    ]);

    const todos = await listOpenTodos(client as never);

    expect(query.eq).toHaveBeenCalledWith("status", "open");
    expect(query.eq).toHaveBeenCalledWith("base.status", "published");
    expect(query.or).toHaveBeenCalledWith(
      "dependent_guide_base_id.is.null,base.not.is.null"
    );
    expect(todos).toEqual([
      {
        id: "request-standalone",
        guide_base_id: null,
        guide_slug: null,
        guide_title: null,
        title: "Standalone",
        summary: "Summary",
        status: "open",
        claim_count: 1,
        created_at: "2026-09-20T00:00:00.000Z",
      },
      {
        id: "request-published",
        guide_base_id: publishedBaseId,
        guide_slug: "published-parent",
        guide_title: "Published Parent",
        title: "Published parent",
        summary: "Summary",
        status: "open",
        claim_count: 2,
        created_at: "2026-09-20T00:00:00.000Z",
      },
    ]);
  });

  it("turns query failures into a service error", async () => {
    const { client } = listSupabase([], new Error("database unavailable"));

    await expect(listOpenTodos(client as never)).rejects.toMatchObject({
      name: "ServiceError",
      message: "Failed to fetch todos",
      status: 500,
    });
  });
});

describe("createTodo", () => {
  it("persists a nullable parent and returns the todo shape", async () => {
    const row = {
      id: "request-standalone",
      dependent_guide_base_id: null,
      title: "Standalone",
      summary: "Summary",
      status: "open",
      created_at: "2026-09-20T00:00:00.000Z",
    };
    const single = vi.fn(async () => ({ data: row, error: null }));
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const client = { from: vi.fn(() => ({ insert })) };

    const todo = await createTodo(
      client as never,
      undefined,
      "Standalone",
      "Summary"
    );

    expect(insert).toHaveBeenCalledWith({
      dependent_guide_base_id: null,
      title: "Standalone",
      summary: "Summary",
      status: "open",
    });
    expect(todo).toEqual({
      id: row.id,
      guide_base_id: null,
      title: row.title,
      summary: row.summary,
      status: row.status,
      created_at: row.created_at,
    });
  });

  it("turns insert failures into a service error", async () => {
    const single = vi.fn(async () => ({
      data: null,
      error: new Error("insert failed"),
    }));
    const client = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({ single })),
        })),
      })),
    };

    await expect(
      createTodo(client as never, undefined, "Standalone", "Summary")
    ).rejects.toEqual(
      expect.objectContaining<ServiceError>({
        name: "ServiceError",
        message: "Failed to create todo",
        status: 500,
      })
    );
  });
});
