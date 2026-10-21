import { describe, expect, it } from "vitest";

import type { TodoListItem } from "@bluelearn/schemas";
import {
  filterTodos,
  objectiveFilterItems,
  subjectFilterItems,
} from "@/lib/todoFilters";

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
    subjects: [],
    objectives: [],
    ...overrides,
  };
}

const withAssociations = (overrides: Partial<TodoListItem>): TodoListItem =>
  makeTodoItem({
    subjects: [
      { slug: "math", name: "Mathematics" },
      { slug: "physics", name: "Physics" },
    ],
    objectives: [{ slug: "calculus-track", title: "Calculus Track" }],
    ...overrides,
  });

describe("filterTodos", () => {
  it("keeps everything when no filters are set", () => {
    const todos = [makeTodoItem(), makeTodoItem()];
    expect(filterTodos(todos, {})).toEqual(todos);
  });

  it("matches the name case-insensitively", () => {
    const match = makeTodoItem({ title: "Linear Algebra Basics" });
    const miss = makeTodoItem({ title: "Vectors" });
    const result = filterTodos([match, miss], { q: "algeBRA bas" });
    expect(result).toEqual([match]);
  });

  it("matches by requesting guide subject", () => {
    const match = withAssociations({});
    const miss = makeTodoItem({
      subjects: [{ slug: "cs", name: "Computer Science" }],
    });
    const result = filterTodos([match, miss], { subject: "physics" });
    expect(result).toEqual([match]);
  });

  it("matches by requesting guide objective", () => {
    const match = withAssociations({});
    const miss = makeTodoItem({
      objectives: [{ slug: "web-dev", title: "Web Dev Track" }],
    });
    const result = filterTodos([match, miss], { objective: "calculus-track" });
    expect(result).toEqual([match]);
  });

  it("combines name, subject, and objective filters", () => {
    const target = withAssociations({ title: "Integrals" });
    const wrongName = withAssociations({ title: "Limits" });
    const wrongSubject = withAssociations({
      title: "Integrals",
      subjects: [{ slug: "cs", name: "Computer Science" }],
    });
    const wrongObjective = withAssociations({
      title: "Integrals",
      objectives: [{ slug: "web-dev", title: "Web Dev Track" }],
    });

    const result = filterTodos(
      [target, wrongName, wrongSubject, wrongObjective],
      {
        q: "integ",
        subject: "physics",
        objective: "calculus-track",
      }
    );

    expect(result).toEqual([target]);
  });
});

describe("subjectFilterItems", () => {
  it("dedupes by slug and sorts by name", () => {
    const todos = [
      withAssociations({}),
      withAssociations({}),
      makeTodoItem({ subjects: [{ slug: "cs", name: "Computer Science" }] }),
    ];
    expect(subjectFilterItems(todos)).toEqual([
      { value: "cs", label: "Computer Science" },
      { value: "math", label: "Mathematics" },
      { value: "physics", label: "Physics" },
    ]);
  });
});

describe("objectiveFilterItems", () => {
  it("dedupes by slug and sorts by title", () => {
    const todos = [
      withAssociations({}),
      withAssociations({}),
      makeTodoItem({
        objectives: [{ slug: "web-dev", title: "Web Dev Track" }],
      }),
    ];
    expect(objectiveFilterItems(todos)).toEqual([
      { value: "calculus-track", label: "Calculus Track" },
      { value: "web-dev", label: "Web Dev Track" },
    ]);
  });
});
