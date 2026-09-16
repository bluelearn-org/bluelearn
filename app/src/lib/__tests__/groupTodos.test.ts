// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { TodoListItem } from "@bluelearn/schemas";
import { groupTodosByTitle } from "@/lib/groupTodos";
import { usePagination } from "@/lib/usePagination";

function makeTodoItem(overrides: Partial<TodoListItem> = {}): TodoListItem {
  return {
    id: crypto.randomUUID(),
    guide_base_id: crypto.randomUUID(),
    guide_slug: "intro-to-math",
    guide_title: "Intro to Math",
    title: "Understanding Derivatives",
    summary: "Need a comprehensive introduction to derivatives.",
    status: "open",
    claim_count: 0,
    created_at: new Date("2026-01-01T10:00:00Z").toISOString(),
    ...overrides,
  };
}

describe("groupTodosByTitle", () => {
  it("returns an empty array when given an empty list", () => {
    expect(groupTodosByTitle([])).toEqual([]);
  });

  it("creates a single group for a single todo item", () => {
    const todo = makeTodoItem({
      title: "Linear Algebra",
      summary: "Vector spaces and matrices",
      claim_count: 2,
    });

    const groups = groupTodosByTitle([todo]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toEqual({
      key: expect.any(String),
      title: "Linear Algebra",
      summary: "Vector spaces and matrices",
      todoIds: [todo.id],
      requestedBy: [{ slug: "intro-to-math", title: "Intro to Math" }],
      claimCount: 2,
    });
  });

  it("combines todos with equivalent normalized titles into one group", () => {
    const todo1 = makeTodoItem({
      id: "id-1",
      title: "Linear Algebra Basics",
      created_at: "2026-01-01T10:00:00Z",
      guide_slug: "guide-a",
      guide_title: "Guide A",
      claim_count: 1,
    });
    const todo2 = makeTodoItem({
      id: "id-2",
      title: "linear-algebra-basics",
      created_at: "2026-01-02T10:00:00Z",
      guide_slug: "guide-b",
      guide_title: "Guide B",
      claim_count: 3,
    });
    const todo3 = makeTodoItem({
      id: "id-3",
      title: "  Linear   Algebra   Basics!  ",
      created_at: "2026-01-03T10:00:00Z",
      guide_slug: "guide-c",
      guide_title: "Guide C",
      claim_count: 0,
    });

    const groups = groupTodosByTitle([todo1, todo2, todo3]);

    expect(groups).toHaveLength(1);
    const [group] = groups;
    expect(group.todoIds).toEqual(["id-1", "id-2", "id-3"]);
    expect(group.claimCount).toBe(3); // maximum claim count
    expect(group.requestedBy).toEqual([
      { slug: "guide-a", title: "Guide A" },
      { slug: "guide-b", title: "Guide B" },
      { slug: "guide-c", title: "Guide C" },
    ]);
    // Keeps earliest created todo's title and summary
    expect(group.title).toBe("Linear Algebra Basics");
  });

  it("ignores items whose title normalizes to an empty string", () => {
    const invalidTodo = makeTodoItem({ title: "---!@#$$%---" });
    const validTodo = makeTodoItem({ title: "Valid Title" });

    const groups = groupTodosByTitle([invalidTodo, validTodo]);

    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe("Valid Title");
  });

  it("filters out items without guide_slug from requestedBy", () => {
    const todoWithoutSlug = makeTodoItem({
      guide_slug: null,
      guide_title: null,
    });

    const groups = groupTodosByTitle([todoWithoutSlug]);

    expect(groups).toHaveLength(1);
    expect(groups[0].requestedBy).toEqual([]);
  });

  it("preserves insertion order of the first occurrence of each normalized title", () => {
    const todoA = makeTodoItem({
      id: "zebra-1",
      title: "Zebra Crossing",
      created_at: "2026-01-01T10:00:00Z",
    });
    const todoB = makeTodoItem({
      id: "alpha-1",
      title: "Alpha Centauri",
      created_at: "2026-01-01T11:00:00Z",
    });
    const todoA2 = makeTodoItem({
      id: "zebra-2",
      title: "zebra crossing",
      created_at: "2026-01-02T10:00:00Z",
    });

    const groups = groupTodosByTitle([todoA, todoB, todoA2]);

    expect(groups).toHaveLength(2);
    expect(groups[0].title).toBe("Zebra Crossing");
    expect(groups[1].title).toBe("Alpha Centauri");
  });
});

describe("todo grouping & pagination invariants", () => {
  const PAGE_SIZE = 10;

  it("does not split raw duplicate rows across pages when total rows exceed PAGE_SIZE", () => {
    // 25 raw todos that all normalize to just 2 unique topics:
    // 15 raw rows for Topic A and 10 raw rows for Topic B.
    const rawTodos: Array<TodoListItem> = [];

    for (let i = 0; i < 15; i++) {
      rawTodos.push(
        makeTodoItem({
          id: `topic-a-${i}`,
          title: `Topic A ${i % 2 === 0 ? "!!" : ""}`,
          created_at: `2026-01-01T${String(i).padStart(2, "0")}:00:00Z`,
        })
      );
    }
    for (let i = 0; i < 10; i++) {
      rawTodos.push(
        makeTodoItem({
          id: `topic-b-${i}`,
          title: `Topic B ${i % 2 === 0 ? "~~" : ""}`,
          created_at: `2026-01-02T${String(i).padStart(2, "0")}:00:00Z`,
        })
      );
    }

    // 25 raw items grouped before pagination result in exactly 2 groups
    const groups = groupTodosByTitle(rawTodos);
    expect(groups).toHaveLength(2);

    // Because there are only 2 groups, they fit completely on 1 page!
    const { result } = renderHook(() => usePagination(groups, PAGE_SIZE));

    expect(result.current.totalPages).toBe(1);
    expect(result.current.pageRows).toHaveLength(2);
    expect(result.current.pageRows[0].todoIds).toHaveLength(15);
    expect(result.current.pageRows[1].todoIds).toHaveLength(10);
  });

  it("correctly slices grouped todos into pages when groups exceed PAGE_SIZE", () => {
    // 15 distinct topics (15 groups)
    const rawTodos = Array.from({ length: 15 }, (_, i) =>
      makeTodoItem({
        id: `id-${i}`,
        title: `Distinct Topic ${i + 1}`,
      })
    );

    const groups = groupTodosByTitle(rawTodos);
    expect(groups).toHaveLength(15);

    const { result } = renderHook(() => usePagination(groups, PAGE_SIZE));

    // Page 1: exactly 10 groups
    expect(result.current.page).toBe(1);
    expect(result.current.totalPages).toBe(2);
    expect(result.current.pageRows).toHaveLength(10);
    expect(result.current.pageRows[0].title).toBe("Distinct Topic 1");
    expect(result.current.pageRows[9].title).toBe("Distinct Topic 10");

    // Navigate to Page 2
    act(() => {
      result.current.onNext();
    });

    expect(result.current.page).toBe(2);
    expect(result.current.pageRows).toHaveLength(5);
    expect(result.current.pageRows[0].title).toBe("Distinct Topic 11");
    expect(result.current.pageRows[4].title).toBe("Distinct Topic 15");
  });

  it("guarantees every group appears exactly once across all pages", () => {
    const rawTodos = Array.from({ length: 24 }, (_, i) =>
      makeTodoItem({
        id: `id-${i}`,
        title: `Topic ${i + 1}`,
      })
    );

    const groups = groupTodosByTitle(rawTodos);
    const seenTitles = new Set<string>();

    const totalPages = Math.ceil(groups.length / PAGE_SIZE);
    expect(totalPages).toBe(3);

    for (let p = 1; p <= totalPages; p++) {
      const pageStart = (p - 1) * PAGE_SIZE;
      const pageRows = groups.slice(pageStart, pageStart + PAGE_SIZE);

      for (const row of pageRows) {
        expect(seenTitles.has(row.title)).toBe(false); // No duplicate across pages
        seenTitles.add(row.title);
      }
    }

    expect(seenTitles.size).toBe(24);
  });
});
