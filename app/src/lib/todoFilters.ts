import type { TodoListItem } from "@bluelearn/schemas";
import type { ComboboxItem } from "@/components/ui/combobox";

export type TodoFilters = {
  q?: string;
  subject?: string;
  objective?: string;
};

// Filter open todos by the requesting guide's associations before they are
// grouped and paginated. Todos don't carry subjects/objectives directly.
export const filterTodos = (
  todos: Array<TodoListItem>,
  { q, subject, objective }: TodoFilters
): Array<TodoListItem> => {
  const query = q?.trim().toLowerCase();

  return todos.filter((todo) => {
    if (query && !todo.title.toLowerCase().includes(query)) return false;
    if (subject && !todo.subjects.some((s) => s.slug === subject)) return false;
    if (objective && !todo.objectives.some((o) => o.slug === objective))
      return false;
    return true;
  });
};

const distinctItems = (
  rows: Array<{ value: string; label: string }>
): Array<ComboboxItem> => {
  const byValue = new Map<string, string>();
  for (const row of rows)
    if (!byValue.has(row.value)) byValue.set(row.value, row.label);
  return [...byValue]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
};

export const subjectFilterItems = (
  todos: Array<TodoListItem>
): Array<ComboboxItem> =>
  distinctItems(
    todos
      .flatMap((t) => t.subjects)
      .map((s) => ({ value: s.slug, label: s.name }))
  );

export const objectiveFilterItems = (
  todos: Array<TodoListItem>
): Array<ComboboxItem> =>
  distinctItems(
    todos
      .flatMap((t) => t.objectives)
      .map((o) => ({ value: o.slug, label: o.title }))
  );
