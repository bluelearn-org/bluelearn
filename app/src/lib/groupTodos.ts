import { normalizeTodoTitle } from "@bluelearn/schemas";
import type { TodoListItem } from "@bluelearn/schemas";

export type TodoGroup = {
  key: string;
  title: string;
  summary: string;
  todoIds: Array<string>;
  requestedBy: Array<{
    kind: "guide" | "objective";
    slug: string;
    title: string | null;
  }>;
  claimCount: number;
};

// titles of todos are free text, so the same topic can arrive as several rows spelled
// differently. One card per normalized title and shows the first requester's
// wording.
export const groupTodosByTitle = (
  todos: Array<TodoListItem>
): Array<TodoGroup> => {
  const grouped = new Map<string, Array<TodoListItem>>();

  for (const todo of todos) {
    const key = normalizeTodoTitle(todo.title);
    if (!key) continue;

    grouped.set(key, [...(grouped.get(key) ?? []), todo]);
  }

  return [...grouped].map(([key, rows]) => {
    const sorted = [...rows].sort(
      (a, b) =>
        a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
    );

    return {
      key,
      title: sorted[0].title,
      summary: sorted[0].summary,
      todoIds: sorted.map((row) => row.id),
      requestedBy: sorted.flatMap((row): TodoGroup["requestedBy"] => {
        if (row.guide_slug) {
          return [
            { kind: "guide", slug: row.guide_slug, title: row.guide_title },
          ];
        }

        if (row.objective_slug) {
          return [
            {
              kind: "objective",
              slug: row.objective_slug,
              title: row.objective_title,
            },
          ];
        }

        return [];
      }),
      claimCount: Math.max(...sorted.map((row) => row.claim_count)),
    };
  });
};
