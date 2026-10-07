import { useEffect } from "react";
import { MarkerType, useEdgesState, useNodesState } from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";
import type { Walkthrough } from "@bluelearn/schemas";
import type { GraphOrientation } from "@/lib/graphOrientation";
import {
  DEFAULT_GRAPH_ORIENTATION,
  describeOrientation,
} from "@/lib/graphOrientation";

type WalkthroughNode = Walkthrough["nodes"][number];

// What the hook writes into every xyflow node's data. id and slug are dropped
// because xyflow keys by slug already.
export type GraphNodeData = Omit<WalkthroughNode, "id" | "slug"> & {
  isTarget: boolean;
  isHovered: boolean;
  isDimmed: boolean;
  orientation: GraphOrientation;
  // The cell center on the axis the level's nodes share, set for that axis
  // only. The node is re-centered on it once xyflow has measured the card.
  centerX: number | null;
  centerY: number | null;
};

// Per-node state that changes without moving anything, merged into node data on
// its own pass so a change never triggers a relayout.
type NodeState = Record<string, unknown>;

const NO_NODE_STATE = (): NodeState => ({});

// Distance between levels when they stack vertically, and when they run across
// the screen (wider, since a card is wider than it is tall).
const LEVEL_SPACING = 350;
const LEVEL_SPACING_ACROSS = 640;
// Distance between the nodes of one level when they stack vertically.
const STACKED_NODE_SPACING = 220;
// First-paint guess at a card's height for the horizontal layouts; measured
// heights replace it on the next pass, like widths do for the vertical ones.
const NODE_HEIGHT_ESTIMATE = 140;

type UseGraphLayoutProps = {
  walkthroughData: Walkthrough;
  targetSlug: string;
  hoveredGuide: string | null;
  nodeType: string;
  nodeWidth: number;
  nodeSpacing: number;
  orientation?: GraphOrientation;
  getNodeState?: (slug: string) => NodeState;
};

// Maps prerequisite -> dependent edges onto slugs, which is what xyflow keys
// nodes by. Returns both directions since hovering walks the DAG each way.
function buildAdjacency(walkthroughData: Walkthrough) {
  const idToSlug = new Map(walkthroughData.nodes.map((n) => [n.id, n.slug]));

  const prereqs = new Map<string, Array<string>>();
  const dependents = new Map<string, Array<string>>();
  walkthroughData.nodes.forEach((n) => {
    prereqs.set(n.slug, []);
    dependents.set(n.slug, []);
  });

  walkthroughData.edges.forEach((edge) => {
    const from = idToSlug.get(edge.from_id);
    const to = idToSlug.get(edge.to_id);
    if (from && to) {
      prereqs.get(to)!.push(from);
      dependents.get(from)!.push(to);
    }
  });

  return { prereqs, dependents };
}

export function getTargetPrerequisiteWalkthrough(
  walkthroughData: Walkthrough,
  targetSlug: string
) {
  const target = walkthroughData.nodes.find((node) => node.slug === targetSlug);
  if (!target) return { nodes: [], edges: [] };

  const incoming = new Map<string, Array<string>>();
  for (const edge of walkthroughData.edges) {
    const prerequisites = incoming.get(edge.to_id);
    if (prerequisites) {
      prerequisites.push(edge.from_id);
    } else {
      incoming.set(edge.to_id, [edge.from_id]);
    }
  }

  const reachable = new Set([target.id]);
  const pending = [target.id];
  while (pending.length > 0) {
    const nodeId = pending.pop()!;
    for (const prerequisiteId of incoming.get(nodeId) ?? []) {
      if (!reachable.has(prerequisiteId)) {
        reachable.add(prerequisiteId);
        pending.push(prerequisiteId);
      }
    }
  }

  const nodes = walkthroughData.nodes.filter((node) => reachable.has(node.id));
  const nodeIds = new Set(nodes.map((node) => node.id));

  return {
    nodes,
    edges: walkthroughData.edges.filter(
      (edge) => nodeIds.has(edge.from_id) && nodeIds.has(edge.to_id)
    ),
  };
}

// Where a measured node belongs: centered on its cell along the axis its level
// shares, and wherever the layout put it along the other. Null until xyflow has
// measured the card on the axis that needs it.
function settledPosition(n: Node) {
  const { centerX, centerY } = n.data as GraphNodeData;
  const { width, height } = n.measured ?? {};
  if (typeof centerX === "number" && !width) return null;
  if (typeof centerY === "number" && !height) return null;
  if (!width && !height) return null;

  return {
    x:
      typeof centerX === "number" && width ? centerX - width / 2 : n.position.x,
    y:
      typeof centerY === "number" && height
        ? centerY - height / 2
        : n.position.y,
  };
}

function isSettled(n: Node, target: { x: number; y: number }) {
  return (
    Math.abs(n.position.x - target.x) < 0.5 &&
    Math.abs(n.position.y - target.y) < 0.5
  );
}

export function useGraphLayout({
  walkthroughData,
  targetSlug,
  hoveredGuide,
  nodeType,
  nodeWidth,
  nodeSpacing,
  orientation = DEFAULT_GRAPH_ORIENTATION,
  getNodeState = NO_NODE_STATE,
}: UseGraphLayoutProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // 1. Layout: positions and static node data. Deliberately independent of
  // hover and selection so those never move a node.
  useEffect(() => {
    const grouped = walkthroughData.nodes.reduce(
      (acc, node) => {
        const list = acc[node.level] ?? [];
        list.push(node);
        acc[node.level] = list;
        return acc;
      },
      {} as Record<number, Array<WalkthroughNode>>
    );

    const levels = Object.keys(grouped)
      .map(Number)
      .sort((a, b) => a - b);
    const maxLevelIdx = levels.length - 1;

    // Levels run along one axis; the nodes of a level spread along the other.
    const { horizontal, reversed } = describeOrientation(orientation);
    const levelSpacing = horizontal ? LEVEL_SPACING_ACROSS : LEVEL_SPACING;
    const siblingSpacing = horizontal ? STACKED_NODE_SPACING : nodeSpacing;

    const newNodes: Array<Node> = [];
    levels.forEach((level, levelIdx) => {
      const nodesInLevel = grouped[level];
      // The target's level sits at the far end of the climb: at the smaller
      // coordinate when the climb runs up or left, the larger otherwise.
      const levelOffset =
        (reversed ? maxLevelIdx - levelIdx : levelIdx) * levelSpacing;

      const totalSpan = nodesInLevel.length * siblingSpacing;
      const start = -totalSpan / 2;

      nodesInLevel.forEach((node, nodeIdx) => {
        const cellCenter =
          start + nodeIdx * siblingSpacing + siblingSpacing / 2;

        newNodes.push({
          id: node.slug,
          type: nodeType,
          position: horizontal
            ? { x: levelOffset, y: cellCenter - NODE_HEIGHT_ESTIMATE / 2 }
            : { x: cellCenter - nodeWidth / 2, y: levelOffset },
          data: {
            title: node.title,
            summary: node.summary,
            level: node.level,
            duration_minutes: node.duration_minutes,
            tags: node.tags,
            isTarget: node.slug === targetSlug,
            isHovered: false,
            isDimmed: false,
            orientation,
            centerX: horizontal ? null : cellCenter,
            centerY: horizontal ? cellCenter : null,
          } satisfies GraphNodeData,
        });
      });
    });

    const { prereqs } = buildAdjacency(walkthroughData);

    // Is `ancestor` reachable from `node`, meaning `node` transitively depends
    // on `ancestor`?
    const isAncestor = (ancestor: string, node: string): boolean => {
      const queue = [...(prereqs.get(node) ?? [])];
      const visited = new Set<string>(queue);

      while (queue.length > 0) {
        const curr = queue.shift()!;
        if (curr === ancestor) return true;

        for (const p of prereqs.get(curr) ?? []) {
          if (!visited.has(p)) {
            visited.add(p);
            queue.push(p);
          }
        }
      }
      return false;
    };

    // Transitive reduction: drop an edge when the same prerequisite is already
    // reachable through another prerequisite of this node, so the graph shows
    // only the closest dependency.
    const newEdges: Array<Edge> = [];
    walkthroughData.nodes.forEach((node) => {
      const nodePrereqs = prereqs.get(node.slug) ?? [];

      nodePrereqs.forEach((prereqSlug) => {
        const isTransient = nodePrereqs.some(
          (otherPrereq) =>
            otherPrereq !== prereqSlug && isAncestor(prereqSlug, otherPrereq)
        );

        if (!isTransient) {
          newEdges.push({
            id: JSON.stringify([prereqSlug, node.slug]),
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
    walkthroughData,
    targetSlug,
    nodeType,
    nodeWidth,
    nodeSpacing,
    orientation,
    setNodes,
    setEdges,
  ]);

  useEffect(() => {
    setNodes((nds) => {
      const next = nds.map((n) => {
        const target = settledPosition(n);
        if (!target || isSettled(n, target)) return n;

        return { ...n, position: target };
      });

      return next.some((n, i) => n !== nds[i]) ? next : nds;
    });
  }, [nodes, setNodes]);
  const isLayoutSettled =
    nodes.length > 0 &&
    nodes.every((n) => {
      const target = settledPosition(n);
      return target !== null && isSettled(n, target);
    });

  // State: hover highlighting plus whatever getNodeState reports, applied
  // without re-running layout.
  useEffect(() => {
    const { prereqs, dependents } = buildAdjacency(walkthroughData);

    // Everything upstream and downstream of the hovered node stays lit; the
    // rest dims.
    const highlighted = new Set<string>();
    if (hoveredGuide) {
      const walk = (adjacency: Map<string, Array<string>>) => {
        const queue = [hoveredGuide];
        const visited = new Set<string>();
        while (queue.length > 0) {
          const cur = queue.shift()!;
          if (visited.has(cur)) continue;
          visited.add(cur);
          highlighted.add(cur);
          queue.push(...(adjacency.get(cur) ?? []));
        }
      };
      walk(prereqs);
      walk(dependents);
    }

    setNodes((nds) =>
      nds.map((n) => {
        const next = {
          ...getNodeState(n.id),
          isDimmed: hoveredGuide !== null && !highlighted.has(n.id),
          isHovered: n.id === hoveredGuide,
        };

        const unchanged = Object.entries(next).every(
          ([key, value]) => n.data[key] === value
        );
        return unchanged ? n : { ...n, data: { ...n.data, ...next } };
      })
    );

    setEdges((eds) =>
      eds.map((e) => {
        const isDimmed =
          hoveredGuide !== null &&
          !(highlighted.has(e.source) && highlighted.has(e.target));
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
  }, [hoveredGuide, getNodeState, walkthroughData, setNodes, setEdges]);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    setNodes,
    isLayoutSettled,
  };
}
