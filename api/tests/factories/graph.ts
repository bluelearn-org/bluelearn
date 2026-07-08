import { insert, type Insert } from "../helpers";

export function createPrerequisite(
  fromGuideBaseId: string,
  toGuideBaseId: string,
  overrides: Partial<Insert<"guide_edges">> = {}
) {
  return insert("guide_edges", {
    from_guide_base_id: fromGuideBaseId,
    to_guide_base_id: toGuideBaseId,
    edge_type: "prerequisite",
    ...overrides,
  });
}

export function createTodo(
  dependentGuideBaseId: string,
  overrides: Partial<Insert<"todo_prerequisites">> = {}
) {
  return insert("todo_prerequisites", {
    dependent_guide_base_id: dependentGuideBaseId,
    title: "Missing prerequisite",
    status: "open",
    ...overrides,
  });
}
