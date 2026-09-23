import { Position } from "@xyflow/react";
import { GuideGraphNode } from "@/components/graph/GuideGraphNode";

// Matches GuideGraphNode's fixedWidth w-[260px], so the layout centres what is
// drawn.
export const OBJECTIVE_NODE_WIDTH = 260;

export type ObjectiveNodeData = {
  title: string;
  summary?: string;
  isTarget: boolean;
  isHovered: boolean;
  isDimmed: boolean;
};

type ObjectiveNodeProps = {
  data: ObjectiveNodeData;
};

// Flip these together with the row order in layoutObjectiveGraph.
const CANVAS_HANDLES = {
  target: Position.Bottom,
  source: Position.Top,
  className:
    "!h-3 !w-3 !cursor-crosshair rounded-full !border-none !bg-primary/70 transition-[width,height,background-color] hover:!h-4.5 hover:!w-4.5 hover:!bg-primary",
};

export function ObjectiveGuideNode({ data }: ObjectiveNodeProps) {
  return (
    <GuideGraphNode
      data={data}
      isSelected={false}
      handles={CANVAS_HANDLES}
      fixedWidth
    />
  );
}

export function ObjectiveRequestNode({ data }: ObjectiveNodeProps) {
  return (
    <GuideGraphNode
      data={data}
      isSelected={false}
      handles={CANVAS_HANDLES}
      fixedWidth
      isRequest
    />
  );
}
