import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { GraphOrientation } from "@/lib/graphOrientation";

// The arrow points the way the climb runs: from prerequisites to the target.
export const GRAPH_ORIENTATION_ICONS: Record<GraphOrientation, LucideIcon> = {
  "bottom-up": ArrowUp,
  "top-down": ArrowDown,
  "left-right": ArrowRight,
  "right-left": ArrowLeft,
};
