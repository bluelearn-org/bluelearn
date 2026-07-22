import { useCallback, useEffect, useRef } from "react";
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { GuideNode } from "./GuideNode";
import type { Edge, Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const nodeTypes = {
  guideNode: GuideNode,
};

type WalkthroughNode = {
  slug: string;
  title: string;
  summary: string;
  level: number;
};

type GuideGraphProps = {
  walkthroughNodes: Array<WalkthroughNode>;
  curatedSequence: Array<string>;
  targetSlug: string;
  onToggleGuide: (slug: string, isChecked: boolean) => void;
  guidesMap: Map<string, any>;
  hoveredGuide: string | null;
  onHoverGuide: (slug: string | null) => void;
};

export function GuideGraph({
  walkthroughNodes,
  curatedSequence,
  targetSlug,
  onToggleGuide,
  guidesMap,
  hoveredGuide,
  onHoverGuide,
}: GuideGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // 1. Initial / Dependency Update: calculate base nodes and edges
  useEffect(() => {
    const grouped = walkthroughNodes.reduce(
      (acc, node) => {
        const list = acc[node.level] ?? [];
        list.push(node);
        acc[node.level] = list;
        return acc;
      },
      {} as Record<number, Array<WalkthroughNode> | undefined>
    );

    const levels = Object.keys(grouped)
      .map(Number)
      .sort((a, b) => a - b);

    const newNodes: Array<Node> = [];
    levels.forEach((level, levelIdx) => {
      const nodesInLevel = grouped[level];
      if (!nodesInLevel) return;
      const levelY = -(levelIdx * 250);

      const totalWidth = nodesInLevel.length * 250;
      const startX = -totalWidth / 2;

      nodesInLevel.forEach((node, nodeIdx) => {
        const isTarget = node.slug === targetSlug;
        const isChecked = isTarget || curatedSequence.includes(node.slug);
        const selectedOrder = curatedSequence.indexOf(node.slug);

        newNodes.push({
          id: node.slug,
          type: "guideNode",
          position: { x: startX + nodeIdx * 250 + 125, y: levelY },
          data: {
            title: node.title,
            isTarget,
            isChecked,
            selectedOrder: selectedOrder !== -1 ? selectedOrder + 1 : null,
            isHovered: false,
            isDimmed: false,
          },
        });
      });
    });

    // Transitive Reduction: Build a map of valid prerequisites for each node
    const prereqMap = new Map<string, Array<string>>();
    walkthroughNodes.forEach((node) => {
      const guide = guidesMap.get(node.slug);
      if (guide && guide.prerequisites) {
        const validPrereqs = guide.prerequisites.filter((p: string) =>
          walkthroughNodes.some((n) => n.slug === p)
        );
        prereqMap.set(node.slug, validPrereqs);
      } else {
        prereqMap.set(node.slug, []);
      }
    });

    // Helper to check if `ancestor` is reachable from `node` (meaning `node` transitively depends on `ancestor`)
    const isAncestor = (ancestor: string, node: string): boolean => {
      const queue = prereqMap.get(node) ? [...prereqMap.get(node)!] : [];
      const visited = new Set<string>(queue);

      while (queue.length > 0) {
        const curr = queue.shift()!;
        if (curr === ancestor) return true;

        const currPrereqs = prereqMap.get(curr) || [];
        for (const p of currPrereqs) {
          if (!visited.has(p)) {
            visited.add(p);
            queue.push(p);
          }
        }
      }
      return false;
    };

    const newEdges: Array<Edge> = [];
    walkthroughNodes.forEach((node) => {
      const prereqs = prereqMap.get(node.slug) || [];

      prereqs.forEach((prereqSlug) => {
        // Check if this dependency is transient (redundant).
        // It is redundant if ANY OTHER prerequisite of this node already transitively depends on prereqSlug.
        const isTransient = prereqs.some(
          (otherPrereq) =>
            otherPrereq !== prereqSlug && isAncestor(prereqSlug, otherPrereq)
        );

        if (!isTransient) {
          newEdges.push({
            id: `e-${prereqSlug}-${node.slug}`,
            source: prereqSlug,
            target: node.slug,
            type: "default",
            style: { stroke: "#94a3b8", strokeWidth: 2 },
            animated: false,
            zIndex: 0,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "#94a3b8",
            },
          });
        }
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [
    walkthroughNodes,
    curatedSequence,
    targetSlug,
    guidesMap,
    setNodes,
    setEdges,
  ]);

  // 2. Hover Update: update isDimmed and isHovered without re-layout
  useEffect(() => {
    const highlightedNodes = new Set<string>();
    if (hoveredGuide) {
      const ancQueue = [hoveredGuide];
      while (ancQueue.length > 0) {
        const cur = ancQueue.shift()!;
        if (!highlightedNodes.has(cur)) {
          highlightedNodes.add(cur);
          const guide = guidesMap.get(cur);
          if (guide && guide.prerequisites) {
            guide.prerequisites.forEach((p: string) => ancQueue.push(p));
          }
        }
      }
      const descQueue = [hoveredGuide];
      const visitedDesc = new Set<string>();
      while (descQueue.length > 0) {
        const cur = descQueue.shift()!;
        if (!visitedDesc.has(cur)) {
          visitedDesc.add(cur);
          highlightedNodes.add(cur);
          walkthroughNodes.forEach((n) => {
            const guide = guidesMap.get(n.slug);
            if (
              guide &&
              guide.prerequisites &&
              guide.prerequisites.includes(cur)
            ) {
              descQueue.push(n.slug);
            }
          });
        }
      }
    }

    setNodes((nds) =>
      nds.map((n) => {
        const isDimmed = hoveredGuide !== null && !highlightedNodes.has(n.id);
        const isHovered = n.id === hoveredGuide;

        if (n.data.isDimmed !== isDimmed || n.data.isHovered !== isHovered) {
          return {
            ...n,
            data: { ...n.data, isDimmed, isHovered },
          };
        }
        return n;
      })
    );

    setEdges((eds) =>
      eds.map((e) => {
        const isDimmed =
          hoveredGuide !== null &&
          !(highlightedNodes.has(e.source) && highlightedNodes.has(e.target));
        const strokeColor = isDimmed
          ? "#94a3b833"
          : hoveredGuide
            ? "#3b82f6"
            : "#94a3b8";
        const strokeWidth = hoveredGuide && !isDimmed ? 3 : 2;
        const zIndex = hoveredGuide && !isDimmed ? 10 : 0;
        const animated = hoveredGuide !== null && !isDimmed;

        if (
          !e.style ||
          e.style.stroke !== strokeColor ||
          e.style.strokeWidth !== strokeWidth ||
          e.animated !== animated
        ) {
          return {
            ...e,
            style: { ...e.style, stroke: strokeColor, strokeWidth },
            animated,
            zIndex,
            markerEnd: { type: MarkerType.ArrowClosed, color: strokeColor },
          };
        }
        return e;
      })
    );
  }, [hoveredGuide, setNodes, setEdges, walkthroughNodes, guidesMap]);

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
