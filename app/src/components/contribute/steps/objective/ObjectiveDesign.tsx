import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  getBezierPath,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";
import type { Dispatch, SetStateAction } from "react";
import type {
  Connection,
  Edge,
  EdgeProps,
  Node,
  OnNodeDrag,
  XYPosition,
} from "@xyflow/react";

import type {
  ContributionType,
  ObjectiveGraphData,
  ObjectiveGraphNode,
} from "@/types/contributions";
import type { listGuides } from "@/lib/api/guides";
import type { ObjectiveNodeData } from "@/components/contribute/steps/objective/ObjectiveGraphNode";
import { getGuideWalkthrough } from "@/lib/api/guides";
import { layoutObjectiveGraph } from "@/lib/objectiveGraphLayout";
import {
  addGuideNode,
  addRequestNode,
  addWalkthrough,
  connectNodes,
  isDrawnEdge,
  removeEdges,
  removeNodes,
} from "@/lib/objectiveGraphEdits";
import { useTheme } from "@/lib/themeProvider";

import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";
import {
  OBJECTIVE_NODE_WIDTH,
  ObjectiveGuideNode,
  ObjectiveRequestNode,
} from "@/components/contribute/steps/objective/ObjectiveGraphNode";

const nodeTypes = {
  objectiveGuide: ObjectiveGuideNode,
  objectiveRequest: ObjectiveRequestNode,
};

const edgeTypes = { drawn: DrawnEdge };

const NODE_SPACING = 320;
const LEVEL_SPACING = 200;
const EDGE_COLOR = "#94a3b8";
const LIT_EDGE_COLOR = "#3b82f6";
const DIMMED_EDGE_COLOR = "#94a3b833";

type Guide = Awaited<ReturnType<typeof listGuides>>[number];

type TargetsChange = { added?: Array<string>; removed?: Array<string> };

type PropTypes = {
  Stepper: any;
  type: ContributionType | null;

  hideBackBtn?: boolean;
  onSaveDraft?: () => void;
  submitting?: boolean;
  guides?: Array<Guide>;
  objectiveGraph: ObjectiveGraphData;
  setObjectiveGraph?: Dispatch<SetStateAction<ObjectiveGraphData>>;
  onTargetsChange?: (change: TargetsChange) => void;
};

export const ObjectiveDesign = ({
  Stepper,
  type,
  hideBackBtn,
  onSaveDraft,
  submitting,
  guides,
  objectiveGraph,
  setObjectiveGraph,
  onTargetsChange,
}: PropTypes) => {
  const guideBaseIdsOnCanvas = objectiveGraph.nodes.flatMap((n) =>
    n.type === "guide_request" ? [] : [n.guideBaseId]
  );

  const addGuideNodes = (nodes: Array<ObjectiveGraphNode>) => {
    setObjectiveGraph?.((graph) =>
      nodes.reduce(
        (next, node) =>
          node.type === "guide_request"
            ? addRequestNode(next, { title: node.title, summary: node.summary })
            : addGuideNode(next, {
                type: node.type,
                guideBaseId: node.guideBaseId,
                guideSlug: node.guideSlug,
                title: node.title,
              }),
        graph
      )
    );

    const targets = nodes.flatMap((n) => (n.type === "target" ? [n] : []));
    if (targets.length === 0) return;

    onTargetsChange?.({ added: targets.map((t) => t.guideSlug) });

    for (const target of targets) {
      getGuideWalkthrough(target.guideSlug)
        .then((walkthrough) =>
          setObjectiveGraph?.((graph) => {
            const targetStillThere = graph.nodes.some(
              (n) => n.type === "target" && n.guideBaseId === target.guideBaseId
            );
            if (!targetStillThere) return graph;

            const added = addWalkthrough(graph, walkthrough);
            const titleOf = (id: string) =>
              added.graph.nodes.find((n) => n.id === id)?.title ?? id;

            for (const edge of added.removedDrawnEdges) {
              const from = titleOf(edge.source);
              const to = titleOf(edge.target);
              toast.warning(
                `Removed ${from} → ${to}: ${to} already comes before ${from}.`,
                { id: edge.id }
              );
            }

            return added.graph;
          })
        )
        .catch(() =>
          toast.error(`Could not load the prerequisites of ${target.title}`)
        );
    }
  };

  return (
    <Stepper.Content step="objective-design">
      <StepperActionHeader
        title="Objective Design"
        Stepper={Stepper}
        type={type}
        hideBackBtn={hideBackBtn}
        onSaveDraft={onSaveDraft}
        submitting={submitting}
        guides={guides}
        existingGuideBaseIds={guideBaseIdsOnCanvas}
        onAddGuideNodes={setObjectiveGraph && addGuideNodes}
      />

      <div className="min-h-[calc(100vh-65px)] min-w-0 flex-1 pt-4">
        <ReactFlowProvider>
          <ObjectiveGraph
            graph={objectiveGraph}
            onGraphChange={setObjectiveGraph}
            onTargetsChange={onTargetsChange}
          />
        </ReactFlowProvider>
      </div>
    </Stepper.Content>
  );
};

type ObjectiveGraphProps = {
  graph: ObjectiveGraphData;
  onGraphChange?: (graph: ObjectiveGraphData) => void;
  onTargetsChange?: (change: TargetsChange) => void;
};

const ObjectiveGraph = ({
  graph,
  onGraphChange,
  onTargetsChange,
}: ObjectiveGraphProps) => {
  const { theme } = useTheme();
  // ponytail: dragged positions live for the session; upgrade when the API stores node positions
  const draggedPositions = useRef(new Map<string, XYPosition>());

  const flowNodes = useMemo(
    () => toFlowNodes(graph, draggedPositions.current),
    [graph]
  );
  const flowEdges = useMemo(() => toFlowEdges(graph), [graph]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  useEffect(() => setNodes(flowNodes), [flowNodes, setNodes]);
  useEffect(() => setEdges(flowEdges), [flowEdges, setEdges]);

  // Same numbers as the walkthrough graph (lib/useGraphLayout.ts), so the two
  // canvases read as one product.
  useEffect(() => {
    const lit = hoveredNodeId
      ? highlightedFrom(graph.edges, hoveredNodeId)
      : new Set<string>();

    setNodes((nds) =>
      nds.map((n) => {
        const isDimmed = hoveredNodeId !== null && !lit.has(n.id);
        return n.data.isDimmed === isDimmed
          ? n
          : { ...n, data: { ...n.data, isDimmed } };
      })
    );

    setEdges((eds) =>
      eds.map((e) => {
        const isLit =
          hoveredNodeId !== null && lit.has(e.source) && lit.has(e.target);
        const stroke = isLit
          ? LIT_EDGE_COLOR
          : hoveredNodeId
            ? DIMMED_EDGE_COLOR
            : EDGE_COLOR;
        const strokeWidth = isLit ? 3 : 2;

        const unchanged =
          e.style?.stroke === stroke &&
          e.style.strokeWidth === strokeWidth &&
          Boolean(e.animated) === isLit;
        return unchanged
          ? e
          : {
              ...e,
              style: { ...e.style, stroke, strokeWidth },
              animated: isLit,
              zIndex: isLit ? 10 : 0,
              markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
            };
      })
    );
  }, [hoveredNodeId, graph, setNodes, setEdges]);

  const handleNodeDragStop: OnNodeDrag = (_event, _node, dragged) => {
    for (const node of dragged)
      draggedPositions.current.set(node.id, node.position);
  };

  const handleConnect = ({ source, target }: Connection) =>
    onGraphChange?.(connectNodes(graph, source, target));

  // onNodesDelete and onEdgesDelete would each edit the same stale graph
  const handleDelete = (deleted: {
    nodes: Array<Node>;
    edges: Array<Edge>;
  }) => {
    const nodeIds = deleted.nodes.map((n) => n.id);
    const edgeIds = deleted.edges.map((e) => e.id);
    const removedTargets = graph.nodes.flatMap((n) =>
      n.type === "target" && nodeIds.includes(n.id) ? [n.guideSlug] : []
    );

    onGraphChange?.(removeEdges(removeNodes(graph, nodeIds), edgeIds));
    if (removedTargets.length > 0)
      onTargetsChange?.({ removed: removedTargets });

    // A deleted node never fires mouse leave, so its hover would dim the rest.
    if (hoveredNodeId && nodeIds.includes(hoveredNodeId))
      setHoveredNodeId(null);
  };

  return (
    // xyflow sizes itself with height: 100%, which needs a definite height here;
    // a flex-1 item resolves that percentage to 0.
    <div className="h-[calc(100vh-250px)] min-h-[600px] overflow-hidden rounded-lg border">
      {graph.nodes.length === 0 ? (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
          No guides yet. Add a guide to start the design.
        </div>
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={handleNodeDragStop}
          onNodeMouseEnter={(_event, node) => setHoveredNodeId(node.id)}
          onNodeMouseLeave={() => setHoveredNodeId(null)}
          onConnect={handleConnect}
          onDelete={handleDelete}
          deleteKeyCode={["Backspace", "Delete"]}
          connectionRadius={40}
          fitView
          nodesDraggable
          nodesConnectable
          elementsSelectable
          colorMode={theme}
          className="bg-transparent"
          minZoom={0.2}
          maxZoom={1.5}
        >
          <Background />
          <Controls />
        </ReactFlow>
      )}
    </div>
  );
};

function toFlowNodes(
  graph: ObjectiveGraphData,
  draggedPositions: Map<string, XYPosition>
): Array<Node<ObjectiveNodeData>> {
  const positionById = new Map(
    layoutObjectiveGraph(graph, {
      nodeWidth: OBJECTIVE_NODE_WIDTH,
      nodeSpacing: NODE_SPACING,
      levelSpacing: LEVEL_SPACING,
    }).map((n) => [n.id, n.position])
  );
  const positionOf = (id: string) =>
    draggedPositions.get(id) ?? positionById.get(id)!;

  return graph.nodes.map((node) =>
    node.type === "guide_request"
      ? {
          id: node.id,
          type: "objectiveRequest",
          position: positionOf(node.id),
          data: {
            title: node.title,
            summary: node.summary,
            isTarget: false,
            isDimmed: false,
          },
        }
      : {
          id: node.id,
          type: "objectiveGuide",
          position: positionOf(node.id),
          data: {
            title: node.title,
            isTarget: node.type === "target",
            isDimmed: false,
          },
        }
  );
}

function toFlowEdges(graph: ObjectiveGraphData): Array<Edge> {
  return graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: isDrawnEdge(edge) ? "drawn" : undefined,
    style: { stroke: EDGE_COLOR, strokeWidth: 2 },
    interactionWidth: 24,
    deletable: isDrawnEdge(edge),
    markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR },
  }));
}

export function highlightedFrom(
  edges: ObjectiveGraphData["edges"],
  hoveredId: string
): Set<string> {
  const reached = new Set<string>();
  const walk = (from: "source" | "target", to: "source" | "target") => {
    const visited = new Set<string>();
    const queue = [hoveredId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      reached.add(current);
      for (const edge of edges)
        if (edge[from] === current) queue.push(edge[to]);
    }
  };

  walk("source", "target");
  walk("target", "source");
  return reached;
}

function DrawnEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  interactionWidth,
  selected,
}: EdgeProps) {
  const { deleteElements } = useReactFlow();
  const [hovered, setHovered] = useState(false);
  const [path, midX, midY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const hover = {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  };

  return (
    <>
      <g {...hover}>
        <BaseEdge
          path={path}
          style={style}
          markerEnd={markerEnd}
          interactionWidth={interactionWidth}
        />
      </g>
      {(hovered || selected) && (
        <EdgeLabelRenderer>
          <button
            {...hover}
            type="button"
            aria-label="Remove connection"
            onClick={() => deleteElements({ edges: [{ id }] })}
            className="nodrag nopan pointer-events-auto absolute flex size-5 items-center justify-center rounded-full border bg-background text-muted-foreground hover:border-destructive hover:text-destructive"
            style={{
              transform: `translate(-50%, -50%) translate(${midX}px, ${midY}px)`,
            }}
          >
            <X className="size-3" />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
