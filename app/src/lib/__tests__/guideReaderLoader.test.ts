import { afterEach, describe, expect, it, vi } from "vitest";

import type { ObjectiveSnapshotNode } from "@bluelearn/schemas";
import { getGuide } from "@/lib/api/guides";
import { getObjective } from "@/lib/api/objectives";
import { Route } from "@/routes/guides/$slug/index";

vi.mock("@/lib/api/guides", () => ({ getGuide: vi.fn() }));
vi.mock("@/lib/api/objectives", () => ({ getObjective: vi.fn() }));
// The route pulls in the auth context, whose client needs env vars on import.
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

const node = (
  id: string,
  fields: Partial<ObjectiveSnapshotNode> = {}
): ObjectiveSnapshotNode => ({
  id,
  guide_base_id: `base-${id}`,
  guide_id: null,
  slug: id,
  title: `Guide ${id}`,
  summary: null,
  request_id: null,
  is_target: false,
  is_included: true,
  is_featured: false,
  target_position: null,
  note: null,
  ...fields,
});

// intro -> setup, then the target ship.
const objectiveResponse = {
  objective: { title: "Build a game" },
  snapshot: {
    nodes: [
      node("intro"),
      node("setup"),
      node("ship", { is_target: true, target_position: 0 }),
    ],
    orders: [
      { target_node_id: "ship", node_id: "intro", position: 0 },
      { target_node_id: "ship", node_id: "setup", position: 1 },
    ],
  },
};

const guide = { title: "Setup" };

// The loader only reads params, deps and the abort signal.
const load = (slug: string, deps: { objective?: string; target?: string }) =>
  (Route.options.loader as (ctx: unknown) => Promise<unknown>)({
    params: { slug },
    deps,
    abortController: new AbortController(),
  });

describe("guide reader loader", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("loads the guide alone outside an objective", async () => {
    vi.mocked(getGuide).mockResolvedValue(guide as never);

    await expect(load("setup", {})).resolves.toEqual({
      guide,
      sequence: null,
    });
    expect(getObjective).not.toHaveBeenCalled();
  });

  it("rebuilds the guide's place in the objective from the URL", async () => {
    vi.mocked(getGuide).mockResolvedValue(guide as never);
    vi.mocked(getObjective).mockResolvedValue(objectiveResponse as never);

    await expect(
      load("setup", { objective: "build-a-game", target: "ship" })
    ).resolves.toEqual({
      guide,
      sequence: {
        objective: { slug: "build-a-game", title: "Build a game" },
        targetId: "ship",
        prev: { slug: "intro", title: "Guide intro" },
        next: { slug: "ship", title: "Guide ship" },
      },
    });
    expect(getObjective).toHaveBeenCalledWith("build-a-game", {
      signal: expect.any(AbortSignal),
    });
  });

  it("drops the sequence when the objective cannot be loaded", async () => {
    vi.mocked(getGuide).mockResolvedValue(guide as never);
    vi.mocked(getObjective).mockRejectedValue(new Error("Not found"));

    await expect(load("setup", { objective: "gone" })).resolves.toEqual({
      guide,
      sequence: null,
    });
  });

  it("drops the sequence when the objective does not hold the guide", async () => {
    vi.mocked(getGuide).mockResolvedValue(guide as never);
    vi.mocked(getObjective).mockResolvedValue(objectiveResponse as never);

    await expect(
      load("elsewhere", { objective: "build-a-game" })
    ).resolves.toEqual({ guide, sequence: null });
  });

  it("still 404s when the guide itself is missing", async () => {
    vi.mocked(getGuide).mockRejectedValue(new Error("Not found"));
    vi.mocked(getObjective).mockResolvedValue(objectiveResponse as never);

    await expect(
      load("missing", { objective: "build-a-game" })
    ).rejects.toMatchObject({ isNotFound: true });
  });
});
