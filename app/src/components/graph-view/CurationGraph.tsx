import { useCallback, useRef } from "react";
import { Background, Controls, ReactFlow } from "@xyflow/react";
import { CurationNode } from "./CurationNode";
import { useGraphLayout } from "./useGraphLayout";
import type { Node } from "@xyflow/react";
import type { WalkthroughNode } from "@/lib/walkthroughUtils";
import "@xyflow/react/dist/style.css";

const nodeTypes = {
  curationNode: CurationNode,
};

type CurationGraphProps = {
  walkthroughNodes: Array<WalkthroughNode>;
  curatedSequence: Array<string>;
  targetSlug: string;
  onToggleGuide: (slug: string, isChecked: boolean) => void;
  guidesMap: Map<string, any>;
  hoveredGuide: string | null;
  onHoverGuide: (slug: string | null) => void;
};

export function CurationGraph({
  walkthroughNodes,
  curatedSequence,
  targetSlug,
  onToggleGuide,
  guidesMap,
  hoveredGuide,
  onHoverGuide,
}: CurationGraphProps) {
  const getNodeData = useCallback(
    (node: WalkthroughNode, isTarget: boolean) => {
      const isChecked = isTarget || curatedSequence.includes(node.slug);
      const selectedOrder = curatedSequence.indexOf(node.slug);
      return {
        isChecked,
        selectedOrder: selectedOrder !== -1 ? selectedOrder + 1 : null,
      };
    },
    [curatedSequence]
  );

  const { nodes, edges, onNodesChange, onEdgesChange } = useGraphLayout({
    walkthroughNodes,
    targetSlug,
    guidesMap,
    hoveredGuide,
    nodeType: "curationNode",
    getNodeData,
  });

  const onNodeClick = useCallback(
    (_: any, node: Node) => {
      if (node.id === targetSlug) return;
      const isCurrentlyChecked = curatedSequence.includes(node.id);
      onToggleGuide(node.id, !isCurrentlyChecked);
    },
    [curatedSequence, targetSlug, onToggleGuide]
  );

  const hoverTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const handleNodeMouseEnter = useCallback(
    (_: any, node: Node) => {
      clearTimeout(hoverTimeoutRef.current);
      onHoverGuide(node.id);
    },
    [onHoverGuide]
  );

  const handleNodeMouseLeave = useCallback(() => {
    clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      onHoverGuide(null);
    }, 50);
  }, [onHoverGuide]);

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        key={targetSlug}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        className="bg-transparent"
        minZoom={0.2}
        maxZoom={1.5}
      >
        <Background
          color="hsl(var(--muted-foreground) / 0.2)"
          gap={24}
          size={2}
        />
        <Controls
          showInteractive={false}
          className="overflow-hidden rounded-xl border-border! bg-background! shadow-md! [&>button]:border-b-border! [&>button]:text-foreground! hover:[&>button]:bg-muted!"
        />
      </ReactFlow>
    </div>
  );
}
