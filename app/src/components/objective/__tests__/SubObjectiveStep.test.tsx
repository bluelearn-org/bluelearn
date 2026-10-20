// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type {
  ObjectiveSnapshot,
  ObjectiveSnapshotNode,
} from "@bluelearn/schemas";
import { buildObjectiveFlow } from "@/lib/objectiveSnapshot";
import { SubObjectiveStep } from "@/components/objective/SubObjectiveStep";

// Keep link destinations visible without mounting the application router.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children: ReactNode;
    to: string;
    params?: { slug: string };
  }) => <a href={params ? to.replace("$slug", params.slug) : to}>{children}</a>,
}));

vi.mock("@/routes/guides/$slug/index", () => ({
  Route: { to: "/guides/$slug" },
}));

const Stepper = {
  Content: ({ children }: { children: ReactNode }) => <div>{children}</div>,
};

const node = (
  id: string,
  fields: Partial<ObjectiveSnapshotNode>
): ObjectiveSnapshotNode => ({
  id,
  guide_base_id: null,
  guide_id: null,
  slug: null,
  title: null,
  summary: null,
  request_id: null,
  is_target: false,
  is_included: true,
  is_featured: false,
  target_position: null,
  note: null,
  ...fields,
});

const snapshot: ObjectiveSnapshot = {
  nodes: [
    node("guide", {
      guide_base_id: "base-guide",
      slug: "loops",
      title: "Loops",
    }),
    node("request-a", { title: "Loop invariants", summary: "Reasoning" }),
    node("request-b", { title: "Termination proofs", is_target: true }),
  ],
  orders: [
    { target_node_id: "request-b", node_id: "guide", position: 0 },
    { target_node_id: "request-b", node_id: "request-a", position: 1 },
  ],
  projected_edges: [],
  raw_edges: [],
  drawn_edges: [],
};

describe("SubObjectiveStep", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("links only the guide and lists each request once, as a request", () => {
    const consoleError = vi.spyOn(console, "error");
    const { targets } = buildObjectiveFlow(snapshot, []);

    render(
      <SubObjectiveStep
        Stepper={Stepper}
        target={targets[0]}
        objective={{ slug: "proofs", title: "Proofs" }}
      />
    );

    const links = screen.queryAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/guides/loops",
    ]);
    expect(
      screen.getByRole("heading", { name: "Loop invariants" })
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Termination proofs" })
    ).toBeTruthy();
    expect(screen.getAllByText("Guide request")).toHaveLength(2);
    expect(screen.getByText("Reasoning")).toBeTruthy();

    const keyWarnings = consoleError.mock.calls.filter((call) =>
      String(call[0]).includes("same key")
    );
    expect(keyWarnings).toHaveLength(0);
  });
});
