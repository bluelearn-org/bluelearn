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
  overrides: Partial<Insert<"requests">> = {}
) {
  return insert("requests", {
    dependent_guide_base_id: dependentGuideBaseId,
    title: "Missing prerequisite",
    summary: "What the missing prerequisite should cover",
    status: "open",
    ...overrides,
  });
}
