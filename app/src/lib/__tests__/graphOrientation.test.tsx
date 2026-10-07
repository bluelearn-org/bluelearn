// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { GraphOrientation } from "@/lib/graphOrientation";
import {
  GraphOrientationProvider,
  describeOrientation,
  isGraphOrientation,
  useGraphOrientation,
} from "@/lib/graphOrientation";
import { GraphOrientationSelector } from "@/components/graph/GraphOrientationSelector";

const STORAGE_KEY = "graph-orientation";

// Records the orientation seen on every render so the first one, which has to
// match the server markup, can be asserted on separately from the settled one.
function renderOrientations() {
  const seen: Array<GraphOrientation> = [];
  let setOrientation: (orientation: GraphOrientation) => void = () => {};

  function Probe() {
    const ctx = useGraphOrientation();
    seen.push(ctx.orientation);
    setOrientation = ctx.setOrientation;
    return null;
  }

  render(
    <GraphOrientationProvider>
      <Probe />
    </GraphOrientationProvider>
  );

  return {
    seen,
    setOrientation: (orientation: GraphOrientation) =>
      setOrientation(orientation),
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(cleanup);

describe("GraphOrientationProvider", () => {
  it("renders bottom-up on the first pass so it matches the server markup", () => {
    localStorage.setItem(STORAGE_KEY, "left-right");

    const { seen } = renderOrientations();

    expect(seen[0]).toBe("bottom-up");
  });

  it("adopts the stored orientation once effects have run", () => {
    localStorage.setItem(STORAGE_KEY, "left-right");

    const { seen } = renderOrientations();

    expect(seen.at(-1)).toBe("left-right");
  });

  it("ignores an unrecognised stored value", () => {
    localStorage.setItem(STORAGE_KEY, "diagonal");

    const { seen } = renderOrientations();

    expect(seen.at(-1)).toBe("bottom-up");
  });

  it("persists the orientation when it is changed", () => {
    const { seen, setOrientation } = renderOrientations();

    act(() => setOrientation("top-down"));

    expect(seen.at(-1)).toBe("top-down");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("top-down");
  });
});

describe("GraphOrientationSelector", () => {
  it("offers every orientation and stores the picked one", () => {
    render(
      <GraphOrientationProvider>
        <GraphOrientationSelector />
      </GraphOrientationProvider>
    );

    const group = screen.getByRole("radiogroup", {
      name: "Default graph orientation",
    });
    expect(
      screen
        .getAllByRole("radio")
        .map((radio) => radio.getAttribute("aria-checked"))
    ).toEqual(["true", "false", "false", "false"]);

    fireEvent.click(screen.getByRole("radio", { name: /Right to left/ }));

    expect(group).toBeDefined();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("right-left");
    expect(screen.getByRole("radio", { name: /Right to left/ })).toHaveProperty(
      "ariaChecked",
      "true"
    );
  });
});

describe("orientation helpers", () => {
  it("accepts only the four known orientations", () => {
    expect(isGraphOrientation("bottom-up")).toBe(true);
    expect(isGraphOrientation("left-right")).toBe(true);
    expect(isGraphOrientation("diagonal")).toBe(false);
    expect(isGraphOrientation(null)).toBe(false);
  });

  it("describes the level axis and climb direction of each orientation", () => {
    expect(describeOrientation("bottom-up")).toEqual({
      horizontal: false,
      reversed: true,
    });
    expect(describeOrientation("top-down")).toEqual({
      horizontal: false,
      reversed: false,
    });
    expect(describeOrientation("left-right")).toEqual({
      horizontal: true,
      reversed: false,
    });
    expect(describeOrientation("right-left")).toEqual({
      horizontal: true,
      reversed: true,
    });
  });
});
