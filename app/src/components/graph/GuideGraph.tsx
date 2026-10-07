import { useCallback, useEffect, useRef } from "react";
import {
  Controls,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import { Fullscreen, Minimize } from "lucide-react";
import type { Node, NodeTypes } from "@xyflow/react";
import type { Walkthrough } from "@bluelearn/schemas";
import type { GraphOrientation } from "@/lib/graphOrientation";
import { DEFAULT_GRAPH_ORIENTATION } from "@/lib/graphOrientation";
import { useGraphLayout } from "@/lib/useGraphLayout";
import { Button } from "@/components/ui/button";
import { GraphOrientationControl } from "@/components/graph/GraphOrientationControl";
import { useTheme } from "@/lib/themeProvider";
import "@xyflow/react/dist/style.css";

const NODE_WIDTH = 320;
const NODE_SPACING = 560;

type GuideGraphProps = {
  walkthroughData: Walkthrough;
  targetSlug: string;
  hoveredGuide: string | null;
  onHoverGuide: (slug: string | null) => void;
  nodeType: string;
  nodeTypes: NodeTypes;
  getNodeState?: (slug: string) => Record<string, unknown>;
  onNodeClick?: (slug: string) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  showFitView?: boolean;
  orientation?: GraphOrientation;
  // Offers the in-graph orientation picker when given.
  onOrientationChange?: (orientation: GraphOrientation) => void;
};

// The provider hoists the xyflow store above the graph, so fitView is callable
// from the first render instead of waiting on onInit.
export function GuideGraph(props: GuideGraphProps) {
  return (
    <ReactFlowProvider>
      <Graph {...props} />
    </ReactFlowProvider>
  );
}

function Graph({
  walkthroughData,
  targetSlug,
  hoveredGuide,
  onHoverGuide,
  nodeType,
  nodeTypes,
  getNodeState,
  onNodeClick,
  isFullscreen,
  onToggleFullscreen,
  showFitView = true,
  orientation = DEFAULT_GRAPH_ORIENTATION,
  onOrientationChange,
}: GuideGraphProps) {
  const { nodes, edges, onNodesChange, onEdgesChange, isLayoutSettled } =
    useGraphLayout({
      walkthroughData,
      targetSlug,
      hoveredGuide,
      nodeType,
      nodeWidth: NODE_WIDTH,
      nodeSpacing: NODE_SPACING,
      orientation,
      getNodeState,
    });

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeClick?.(node.id);
    },
    [onNodeClick]
  );

  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleNodeMouseEnter = useCallback(
    (_: React.MouseEvent, node: Node) => {
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

  const { fitView } = useReactFlow();
  const { theme } = useTheme();
  const layoutSignature = isLayoutSettled
    ? nodes
        .map(
          (n) =>
            `${n.id}:${n.position.x}:${n.position.y}:${n.measured?.width}:${n.measured?.height}`
        )
        .join("|")
    : null;

  useEffect(() => {
    if (!layoutSignature) return;

    void fitView();
  }, [layoutSignature, fitView]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fitView({ duration: 300 });
    }, 50);

    return () => clearTimeout(timeout);
  }, [isFullscreen, fitView]);

  return (
    <div
      className={`relative h-full min-h-[500px] w-full transition-opacity duration-150 ${
        layoutSignature ? "opacity-100" : "opacity-0"
      }`}
    >
      <ReactFlow
        key={targetSlug}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        nodeTypes={nodeTypes}
        proOptions={{ hideAttribution: true }}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        colorMode={theme}
        className="bg-transparent"
        minZoom={0.2}
        maxZoom={1.5}
      >
        {(onToggleFullscreen || onOrientationChange) && (
          <Panel position="top-right" className="m-4 flex items-center gap-2">
            {onOrientationChange && (
              <GraphOrientationControl
                orientation={orientation}
                onChange={onOrientationChange}
              />
            )}

            {onToggleFullscreen && (
              <Button
                variant="outline"
                size="icon"
                onClick={onToggleFullscreen}
                className="h-8 w-8 border-border/50 bg-background/80 shadow-sm backdrop-blur-md"
                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              >
                {isFullscreen ? <Minimize /> : <Fullscreen />}
              </Button>
            )}
          </Panel>
        )}

        <Controls
          position="bottom-right"
          showInteractive={false}
          showFitView={showFitView}
          className="overflow-hidden rounded-sm border! border-foreground! bg-background! shadow-none! [&_svg]:max-h-[15px]! [&_svg]:max-w-[15px]! [&>button]:h-8! [&>button]:w-8! [&>button]:border-b-foreground! [&>button]:p-2! [&>button]:text-foreground! [&>button:hover]:bg-muted!"
        />
      </ReactFlow>
    </div>
  );
}
