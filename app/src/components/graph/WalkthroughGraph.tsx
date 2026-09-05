import { useCallback } from "react";
import { GuideGraph } from "./GuideGraph";
import { WalkthroughNode } from "./WalkthroughNode";
import type { Walkthrough } from "@bluelearn/schemas";
import "@xyflow/react/dist/style.css";

const nodeTypes = {
  walkthroughNode: WalkthroughNode,
};

type WalkthroughGraphProps = {
  walkthroughData: Walkthrough;
  targetSlug: string;
  hoveredGuide: string | null;
  onHoverGuide: (slug: string | null) => void;
  selectedGuide: string;
  onSelectGuide: (slug: string) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
};

export function WalkthroughGraph({
  selectedGuide,
  onSelectGuide,
  ...rest
}: WalkthroughGraphProps) {
  const getNodeState = useCallback(
    (slug: string) => ({ isSelected: slug === selectedGuide }),
    [selectedGuide]
  );

  return (
    <GuideGraph
      {...rest}
      showFitView={false}
      nodeType="walkthroughNode"
      nodeTypes={nodeTypes}
      getNodeState={getNodeState}
      onNodeClick={onSelectGuide}
    />
  );
}
