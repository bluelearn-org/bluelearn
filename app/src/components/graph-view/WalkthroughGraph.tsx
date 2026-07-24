import { useCallback, useEffect, useRef } from "react";
import { Background, Controls, Panel, ReactFlow } from "@xyflow/react";
import { Maximize, Minimize } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { WalkthroughNode as WalkthroughNodeComponent } from "./WalkthroughNode";
import { useGraphLayout } from "./useGraphLayout";
import type { Node, ReactFlowInstance } from "@xyflow/react";
import type { GraphData, GraphNode } from "@/lib/graphUtils";
import { Button } from "@/components/ui/button";
import "@xyflow/react/dist/style.css";

const nodeTypes = {
  walkthroughNode: WalkthroughNodeComponent,
};

type WalkthroughGraphProps = {
  walkthroughData: GraphData;
  targetSlug: string;
  hoveredGuide: string | null;
  onHoverGuide: (slug: string | null) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
};

export function WalkthroughGraph({
  walkthroughData,
  targetSlug,
  hoveredGuide,
  onHoverGuide,
  isFullscreen,
  onToggleFullscreen,
}: WalkthroughGraphProps) {
  const navigate = useNavigate();

  const getNodeData = useCallback((node: GraphNode) => {
    return {
      summary: node.summary,
      level: node.level,
      duration: Math.max(1, Math.ceil(node.word_count / 225)),
      tags: node.tags,
    };
  }, []);

  const { nodes, edges, onNodesChange, onEdgesChange } = useGraphLayout({
    walkthroughData,
    targetSlug,
    hoveredGuide,
    nodeType: "walkthroughNode",
    getNodeData,
  });

  const onNodeClick = useCallback(
    (_: any, node: Node) => {
      navigate({ to: `/guides/${node.id}` });
    },
    [navigate]
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

  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  useEffect(() => {
    if (reactFlowInstance.current) {
      setTimeout(() => {
        reactFlowInstance.current?.fitView({ duration: 300 });
      }, 50);
    }
  }, [isFullscreen]);

  return (
    <div className="relative h-full min-h-[500px] w-full">
      <ReactFlow
        onInit={(instance) => {
          reactFlowInstance.current = instance;
        }}
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

        {onToggleFullscreen && (
          <Panel position="top-right" className="m-4 flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={onToggleFullscreen}
              className="h-10 w-10 border-border/50 bg-background/80 shadow-sm backdrop-blur-md"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? (
                <Minimize className="h-4 w-4" />
              ) : (
                <Maximize className="h-4 w-4" />
              )}
            </Button>
          </Panel>
        )}

        <Controls
          showInteractive={false}
          className="overflow-hidden rounded-xl border-border! bg-background! shadow-md! [&>button]:border-b-border! [&>button]:text-foreground! hover:[&>button]:bg-muted!"
        />
      </ReactFlow>
    </div>
  );
}
