import { createContext, useContext, useEffect, useState } from "react";

import type { ReactNode } from "react";

// How a graph lays its levels out. Prerequisites always sit on the start side
// and the target on the end side; the name says which way the climb runs.
export const GRAPH_ORIENTATIONS = [
  "bottom-up",
  "top-down",
  "left-right",
  "right-left",
] as const;

export type GraphOrientation = (typeof GRAPH_ORIENTATIONS)[number];

export const DEFAULT_GRAPH_ORIENTATION: GraphOrientation = "bottom-up";

export const GRAPH_ORIENTATION_OPTIONS: ReadonlyArray<{
  id: GraphOrientation;
  label: string;
  description: string;
}> = [
  {
    id: "bottom-up",
    label: "Bottom up",
    description: "Prerequisites at the bottom, climbing to the target on top.",
  },
  {
    id: "top-down",
    label: "Top down",
    description: "Prerequisites at the top, reading down to the target.",
  },
  {
    id: "left-right",
    label: "Left to right",
    description: "Prerequisites on the left, reading across to the target.",
  },
  {
    id: "right-left",
    label: "Right to left",
    description: "Prerequisites on the right, reading across to the target.",
  },
];

export function isGraphOrientation(value: unknown): value is GraphOrientation {
  return (
    typeof value === "string" &&
    (GRAPH_ORIENTATIONS as ReadonlyArray<string>).includes(value)
  );
}

// Which axis the levels run along, and whether the target sits at the smaller
// coordinate (up or left on screen). Layout and handle placement derive from
// these two facts alone.
export function describeOrientation(orientation: GraphOrientation) {
  return {
    horizontal: orientation === "left-right" || orientation === "right-left",
    reversed: orientation === "bottom-up" || orientation === "right-left",
  };
}

const STORAGE_KEY = "graph-orientation";

type GraphOrientationContextType = {
  orientation: GraphOrientation;
  setOrientation: (orientation: GraphOrientation) => void;
};

const GraphOrientationContext =
  createContext<GraphOrientationContextType | null>(null);

function readStoredOrientation(): GraphOrientation {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return isGraphOrientation(saved) ? saved : DEFAULT_GRAPH_ORIENTATION;
  } catch {
    return DEFAULT_GRAPH_ORIENTATION;
  }
}

// The reader's default orientation, kept in the browser like the theme is.
export function GraphOrientationProvider({
  children,
}: {
  children: ReactNode;
}) {
  // Render the default first so the client matches the server markup, then
  // adopt the stored preference once hydrated, as ThemeProvider does.
  const [orientation, setOrientationState] = useState<GraphOrientation>(
    DEFAULT_GRAPH_ORIENTATION
  );

  useEffect(() => {
    setOrientationState(readStoredOrientation());
  }, []);

  function setOrientation(next: GraphOrientation) {
    setOrientationState(next);

    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable (private mode, blocked site data); the
      // choice then lasts for this page only.
    }
  }

  return (
    <GraphOrientationContext.Provider value={{ orientation, setOrientation }}>
      {children}
    </GraphOrientationContext.Provider>
  );
}

export function useGraphOrientation() {
  const ctx = useContext(GraphOrientationContext);

  if (!ctx) {
    throw new Error(
      "useGraphOrientation must be used inside GraphOrientationProvider"
    );
  }

  return ctx;
}
