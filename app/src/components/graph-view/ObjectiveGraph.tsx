import { useCallback, useEffect, useRef } from "react";
import { Background, Controls, Panel, ReactFlow } from "@xyflow/react";
import { Check, ChevronDown, Maximize, Minimize, Target } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { ObjectiveNode as ObjectiveNodeComponent } from "./ObjectiveNode";
import { useGraphLayout } from "./useGraphLayout";
import type { Node, ReactFlowInstance } from "@xyflow/react";
import type { GraphData, GraphNode } from "@/lib/graphUtils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import "@xyflow/react/dist/style.css";

const nodeTypes = {
  objectiveNode: ObjectiveNodeComponent,
};

type ObjectiveGraphProps = {
  walkthroughData: GraphData;
  targetSlug?: string;
  hoveredGuide: string | null;
  onHoverGuide: (slug: string | null) => void;
  focusedTarget?: string | null;
  onFocusTarget?: (slug: string | null) => void;
  targetGuides?: Array<{
    slug: string;
    title: string;
    subobjectives?: Array<{ level: number; guide: string }>;
  }>;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
};

export function ObjectiveGraph({
  walkthroughData,
  targetSlug,
  hoveredGuide,
  onHoverGuide,
  focusedTarget,
  onFocusTarget,
  targetGuides,
  isFullscreen,
  onToggleFullscreen,
}: ObjectiveGraphProps) {
  const navigate = useNavigate();

  const getNodeData = useCallback(
    (node: GraphNode) => {
      let curatedPosition: number | undefined = undefined;

      if (focusedTarget && targetGuides) {
        const activeTarget = targetGuides.find((t) => t.slug === focusedTarget);
        if (activeTarget && activeTarget.subobjectives) {
          const match = activeTarget.subobjectives.find(
            (sub) => sub.guide === node.slug
          );
          if (match) {
            curatedPosition = match.level;
          }
        }
      }

      return {
        summary: node.summary,
        level: node.level,
        duration: Math.max(1, Math.ceil(node.word_count / 225)),
        tags: node.tags,
        curatedPosition,
      };
    },
    [focusedTarget, targetGuides]
  );

  const { nodes, edges, onNodesChange, onEdgesChange } = useGraphLayout({
    walkthroughData,
    targetSlug: focusedTarget || targetSlug,
    hoveredGuide,
    nodeType: "objectiveNode",
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
        key={targetSlug || "objective-graph"}
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

        {((targetGuides && targetGuides.length > 0 && onFocusTarget) ||
          onToggleFullscreen) && (
          <Panel position="top-right" className="m-4 flex items-center gap-2">
            {targetGuides && targetGuides.length > 0 && onFocusTarget && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 gap-2 border-border/50 bg-background/80 shadow-sm backdrop-blur-md"
                  >
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold tracking-wide">
                      {focusedTarget
                        ? targetGuides.find((g) => g.slug === focusedTarget)
                            ?.title || "Focus Target"
                        : "Filter by Target..."}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[280px]">
                  {targetGuides.map((guide) => {
                    const isActive = focusedTarget === guide.slug;
                    return (
                      <DropdownMenuItem
                        key={guide.slug}
                        onClick={() =>
                          onFocusTarget(isActive ? null : guide.slug)
                        }
                        className="flex cursor-pointer items-center justify-between py-2"
                      >
                        <span className="truncate pr-2">{guide.title}</span>
                        {isActive && (
                          <Check className="h-4 w-4 shrink-0 text-primary" />
                        )}
                      </DropdownMenuItem>
                    );
                  })}

                  {focusedTarget && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onFocusTarget(null)}
                        className="cursor-pointer justify-center font-medium text-destructive focus:bg-destructive/10 focus:text-destructive"
                      >
                        Clear Focus
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {onToggleFullscreen && (
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
            )}
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
