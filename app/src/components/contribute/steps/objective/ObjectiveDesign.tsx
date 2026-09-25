import { useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  ConnectionMode,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";
import type { Dispatch, SetStateAction } from "react";
import type {
  Connection,
  Edge,
  Node,
  OnConnectEnd,
  OnNodeDrag,
  OnNodesChange,
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
  edgesCutByConnecting,
  isDrawnEdge,
  removeEdges,
  removeNodes,
  targetNodeIds,
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

const NODE_SPACING = 320;
const LEVEL_SPACING = 200;
// How far a drag may pull a card off its row, short of the next row's cards.
const ROW_SLACK = LEVEL_SPACING / 4;
// xyflow tags the card being dragged with .dragging, which must follow the
// pointer; every other move (a release, a relayout) glides.
const GLIDE_TO_SLOT =
  "transition-transform duration-300 ease-out [&.dragging]:transition-none";
const EDGE_COLOR = "#94a3b8";
const PREREQUISITE_EDGE_COLOR = "var(--brand-orange)";
const FOLLOW_UP_EDGE_COLOR = "var(--brand-muted-green)";
const DIMMED_EDGE_COLOR = "#94a3b833";

type Guide = Awaited<ReturnType<typeof listGuides>>[number];

type PropTypes = {
  Stepper: any;
  type: ContributionType | null;

  hideBackBtn?: boolean;
  onSaveDraft?: () => void;
  submitting?: boolean;
  isDirty?: boolean;
  isSynced?: boolean;
  guides?: Array<Guide>;
  objectiveGraph: ObjectiveGraphData;
  setObjectiveGraph?: Dispatch<SetStateAction<ObjectiveGraphData>>;
};

export const ObjectiveDesign = ({
  Stepper,
  type,
  hideBackBtn,
  onSaveDraft,
  submitting,
  isDirty,
  isSynced,
  guides,
  objectiveGraph,
  setObjectiveGraph,
}: PropTypes) => {
  const guideBaseIdsOnCanvas = objectiveGraph.nodes.flatMap((n) =>
    n.type === "guide_request" ? [] : [n.guideBaseId]
  );

  const addGuideNodes = (
    nodes: Array<ObjectiveGraphNode>,
    { pullPrerequisitesFor = [] }: { pullPrerequisitesFor?: Array<string> } = {}
  ) => {
    setObjectiveGraph?.((graph) =>
      nodes.reduce(
        (next, node) =>
          node.type === "guide_request"
            ? addRequestNode(next, { title: node.title, summary: node.summary })
            : addGuideNode(next, {
                guideBaseId: node.guideBaseId,
                guideSlug: node.guideSlug,
                title: node.title,
              }),
        graph
      )
    );

    const pulled = nodes.flatMap((n) =>
      n.type === "guide" && pullPrerequisitesFor.includes(n.guideBaseId)
        ? [n]
        : []
    );

    for (const guide of pulled) {
      getGuideWalkthrough(guide.guideSlug)
        .then((walkthrough) =>
          setObjectiveGraph?.((graph) => {
            const guideStillThere = graph.nodes.some(
              (n) => n.type === "guide" && n.guideBaseId === guide.guideBaseId
            );
            if (!guideStillThere) return graph;

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
          toast.error(`Could not load the prerequisites of ${guide.title}`)
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
        isDirty={isDirty}
        isSynced={isSynced}
        guides={guides}
        existingGuideBaseIds={guideBaseIdsOnCanvas}
        onAddGuideNodes={setObjectiveGraph && addGuideNodes}
      />

      <div className="min-h-[calc(100vh-65px)] min-w-0 flex-1 pt-4">
        <ReactFlowProvider>
          <ObjectiveGraph
            graph={objectiveGraph}
            onGraphChange={setObjectiveGraph}
          />
        </ReactFlowProvider>
      </div>
    </Stepper.Content>
  );
};

type ObjectiveGraphProps = {
  graph: ObjectiveGraphData;
  onGraphChange?: (graph: ObjectiveGraphData) => void;
};

const ObjectiveGraph = ({ graph, onGraphChange }: ObjectiveGraphProps) => {
  const { theme } = useTheme();

  const flowNodes = useMemo(() => toFlowNodes(graph), [graph]);
  const flowEdges = useMemo(() => toFlowEdges(graph), [graph]);
  const slotById = useMemo(
    () => new Map(flowNodes.map((n) => [n.id, n.position])),
    [flowNodes]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  useEffect(() => setNodes(flowNodes), [flowNodes, setNodes]);
  useEffect(() => setEdges(flowEdges), [flowEdges, setEdges]);

  // Widths and dimming match the walkthrough graph (lib/useGraphLayout.ts);
  // only the design canvas tells a guide's prerequisites from its follow-ups.
  useEffect(() => {
    const { upstream, downstream } = hoveredNodeId
      ? upstreamAndDownstream(graph.edges, hoveredNodeId)
      : { upstream: new Set<string>(), downstream: new Set<string>() };
    const onPrerequisiteSide = (id: string) =>
      id === hoveredNodeId || upstream.has(id);
    const onFollowUpSide = (id: string) =>
      id === hoveredNodeId || downstream.has(id);

    setNodes((nds) =>
      nds.map((n) => {
        const isDimmed =
          hoveredNodeId !== null &&
          !onPrerequisiteSide(n.id) &&
          !onFollowUpSide(n.id);
        const isHovered = n.id === hoveredNodeId;
        return n.data.isDimmed === isDimmed && n.data.isHovered === isHovered
          ? n
          : { ...n, data: { ...n.data, isDimmed, isHovered } };
      })
    );

    setEdges((eds) =>
      eds
        .map((e) => {
          const isPrerequisite =
            onPrerequisiteSide(e.source) && onPrerequisiteSide(e.target);
          const isFollowUp =
            onFollowUpSide(e.source) && onFollowUpSide(e.target);
          const isLit = isPrerequisite || isFollowUp;

          let stroke = hoveredNodeId ? DIMMED_EDGE_COLOR : EDGE_COLOR;
          if (isPrerequisite) stroke = PREREQUISITE_EDGE_COLOR;
          else if (isFollowUp) stroke = FOLLOW_UP_EDGE_COLOR;
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
                markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
              };
        })
        .sort(
          (a, b) => Number(Boolean(a.animated)) - Number(Boolean(b.animated))
        )
    );
  }, [hoveredNodeId, graph, setNodes, setEdges]);

  // Drag is a nudge along the card's row; the layout stays the resting state.
  const handleNodesChange: OnNodesChange<Node<ObjectiveNodeData>> = (changes) =>
    onNodesChange(
      changes.map((change) => {
        if (change.type !== "position" || !change.position) return change;
        const slot = slotById.get(change.id);
        if (!slot) return change;

        const y = Math.min(
          Math.max(change.position.y, slot.y - ROW_SLACK),
          slot.y + ROW_SLACK
        );
        return { ...change, position: { ...change.position, y } };
      })
    );

  const handleNodeDragStop: OnNodeDrag = (_event, _node, dragged) => {
    const draggedIds = new Set(dragged.map((node) => node.id));
    setNodes((nds) =>
      nds.map((n) =>
        draggedIds.has(n.id) ? { ...n, position: slotById.get(n.id)! } : n
      )
    );
  };

  // base lets a reconnect drop its old edge in the same graph write
  const connect = (source: string, target: string, base = graph) => {
    const cut = edgesCutByConnecting(base, source, target);
    onGraphChange?.(connectNodes(base, source, target));
    if (cut.length === 0) return;

    const titleOf = (id: string) =>
      graph.nodes.find((n) => n.id === id)?.title ?? id;
    const arrow = (from: string, to: string) =>
      `${titleOf(from)} → ${titleOf(to)}`;
    toast.warning(
      `Kept ${arrow(source, target)}; removed ${cut
        .map((e) => arrow(e.source, e.target))
        .join(", ")}.`
    );
  };

  // The drawn edge whose end is mid-drag. Any connect path that lands it clears
  // this; whatever is still here at reconnect end is dropped on nothing.
  const reconnecting = useRef<Edge | null>(null);

  // A re-attach drops the old edge in the same graph write as the new one
  const connectOrReattach = (source: string, target: string) => {
    const oldEdge = reconnecting.current;
    reconnecting.current = null;
    connect(source, target, oldEdge ? removeEdges(graph, [oldEdge.id]) : graph);
  };

  // In loose mode xyflow reads direction off the start dot: a top (source) dot
  // leads to the other node, a bottom (target) dot takes it as a prerequisite.
  const handleConnect = ({ source, target }: Connection) =>
    connectOrReattach(source, target);

  // A drop on a card's body, off its dots, connects to that card by the same
  // start-dot rule.
  const handleConnectEnd: OnConnectEnd = (
    event,
    { isValid, fromNode, fromHandle }
  ) => {
    if (isValid || !fromNode) return;

    // touchend lists the lifted finger in changedTouches
    const point = "changedTouches" in event ? event.changedTouches[0] : event;
    const card = document
      .elementFromPoint(point.clientX, point.clientY)
      ?.closest<HTMLElement>(".react-flow__node");
    const cardId = card?.dataset.id;
    if (!cardId || cardId === fromNode.id) return;

    if (fromHandle.type === "source") connectOrReattach(fromNode.id, cardId);
    else connectOrReattach(cardId, fromNode.id);
  };

  // onNodesDelete and onEdgesDelete would each edit the same stale graph
  const handleDelete = (deleted: {
    nodes: Array<Node>;
    edges: Array<Edge>;
  }) => {
    const nodeIds = deleted.nodes.map((n) => n.id);
    const edgeIds = deleted.edges.map((e) => e.id);
    onGraphChange?.(removeEdges(removeNodes(graph, nodeIds), edgeIds));

    // A deleted node never fires mouse leave, so its hover would dim the rest.
    if (hoveredNodeId && nodeIds.includes(hoveredNodeId))
      setHoveredNodeId(null);
  };

  // xyflow fires onReconnect (dot drop), then onConnectEnd (body drop), then
  // onReconnectEnd; a drop on neither deletes the edge.
  const handleReconnectStart = (_event: unknown, edge: Edge) => {
    reconnecting.current = edge;
  };

  const handleReconnect = (_oldEdge: Edge, { source, target }: Connection) =>
    connectOrReattach(source, target);

  const handleReconnectEnd = (_event: MouseEvent | TouchEvent, edge: Edge) => {
    if (!reconnecting.current) return;

    reconnecting.current = null;
    handleDelete({ nodes: [], edges: [edge] });
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
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={handleNodeDragStop}
          onNodeMouseEnter={(_event, node) => setHoveredNodeId(node.id)}
          onNodeMouseLeave={() => setHoveredNodeId(null)}
          onConnect={handleConnect}
          onConnectEnd={handleConnectEnd}
          edgesReconnectable
          onReconnectStart={handleReconnectStart}
          onReconnect={handleReconnect}
          onReconnectEnd={handleReconnectEnd}
          connectionMode={ConnectionMode.Loose}
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
  graph: ObjectiveGraphData
): Array<Node<ObjectiveNodeData>> {
  const positionById = new Map(
    layoutObjectiveGraph(graph, {
      nodeWidth: OBJECTIVE_NODE_WIDTH,
      nodeSpacing: NODE_SPACING,
      levelSpacing: LEVEL_SPACING,
    }).map((n) => [n.id, n.position])
  );
  const positionOf = (id: string) => positionById.get(id)!;
  const targets = targetNodeIds(graph);

  return graph.nodes.map((node) =>
    node.type === "guide_request"
      ? {
          id: node.id,
          type: "objectiveRequest",
          className: GLIDE_TO_SLOT,
          position: positionOf(node.id),
          data: {
            title: node.title,
            summary: node.summary,
            isTarget: targets.has(node.id),
            isHovered: false,
            isDimmed: false,
          },
        }
      : {
          id: node.id,
          type: "objectiveGuide",
          className: GLIDE_TO_SLOT,
          position: positionOf(node.id),
          data: {
            title: node.title,
            isTarget: targets.has(node.id),
            isHovered: false,
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
    style: { stroke: EDGE_COLOR, strokeWidth: 2 },
    interactionWidth: 24,
    deletable: isDrawnEdge(edge),
    reconnectable: isDrawnEdge(edge),
    markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR },
  }));
}

export function upstreamAndDownstream(
  edges: ObjectiveGraphData["edges"],
  hoveredId: string
): { upstream: Set<string>; downstream: Set<string> } {
  const walk = (from: "source" | "target", to: "source" | "target") => {
    const reached = new Set<string>();
    const queue = [hoveredId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const edge of edges)
        if (edge[from] === current && !reached.has(edge[to])) {
          reached.add(edge[to]);
          queue.push(edge[to]);
        }
    }

    reached.delete(hoveredId);
    return reached;
  };

  return {
    upstream: walk("target", "source"),
    downstream: walk("source", "target"),
  };
}
