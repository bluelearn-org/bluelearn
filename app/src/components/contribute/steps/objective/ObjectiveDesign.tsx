import { useEffect, useMemo } from "react";
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import type { Connection, Edge, Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type {
  ContributionType,
  ObjectiveGraphData,
  ObjectiveGraphNode,
} from "@/types/contributions";
import type { listGuides } from "@/lib/api/guides";
import type { ObjectiveNodeData } from "@/components/contribute/steps/objective/ObjectiveGraphNode";
import { layoutObjectiveGraph } from "@/lib/objectiveGraphLayout";
import {
  addGuideNode,
  addRequestNode,
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

const NODE_SPACING = 320;
const LEVEL_SPACING = 200;
const EDGE_COLOR = "#94a3b8";

type Guide = Awaited<ReturnType<typeof listGuides>>[number];

type PropTypes = {
  Stepper: any;
  type: ContributionType | null;

  hideBackBtn?: boolean;
  onSaveDraft?: () => void;
  submitting?: boolean;
  guides?: Array<Guide>;
  objectiveGraph: ObjectiveGraphData;
  setObjectiveGraph?: (graph: ObjectiveGraphData) => void;
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
}: PropTypes) => {
  const guideBaseIdsOnCanvas = objectiveGraph.nodes.flatMap((n) =>
    n.type === "guide_request" ? [] : [n.guideBaseId]
  );

  const addGuideNodes = (nodes: Array<ObjectiveGraphNode>) => {
    const graph = nodes.reduce(
      (next, node) =>
        node.type === "guide_request"
          ? addRequestNode(next, { title: node.title, summary: node.summary })
          : addGuideNode(next, {
              guideBaseId: node.guideBaseId,
              guideSlug: node.guideSlug,
              title: node.title,
            }),
      objectiveGraph
    );

    setObjectiveGraph?.(graph);
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

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  useEffect(() => setNodes(flowNodes), [flowNodes, setNodes]);
  useEffect(() => setEdges(flowEdges), [flowEdges, setEdges]);

  const handleConnect = ({ source, target }: Connection) =>
    onGraphChange?.(connectNodes(graph, source, target));

  // onNodesDelete and onEdgesDelete would each edit the same stale graph
  const handleDelete = (deleted: {
    nodes: Array<Node>;
    edges: Array<Edge>;
  }) => {
    const nodeIds = deleted.nodes.map((n) => n.id);
    const edgeIds = deleted.edges.map((e) => e.id);

    onGraphChange?.(removeEdges(removeNodes(graph, nodeIds), edgeIds));
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
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={handleConnect}
          onDelete={handleDelete}
          deleteKeyCode={["Backspace", "Delete"]}
          fitView
          nodesDraggable={false}
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

  return graph.nodes.map((node) =>
    node.type === "guide_request"
      ? {
          id: node.id,
          type: "objectiveRequest",
          position: positionById.get(node.id)!,
          data: { title: node.title, summary: node.summary, isTarget: false },
        }
      : {
          id: node.id,
          type: "objectiveGuide",
          position: positionById.get(node.id)!,
          data: { title: node.title, isTarget: node.type === "target" },
        }
  );
}

function toFlowEdges(graph: ObjectiveGraphData): Array<Edge> {
  return graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    style: { stroke: EDGE_COLOR, strokeWidth: 2 },
    deletable: isDrawnEdge(edge),
    markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR },
  }));
}
