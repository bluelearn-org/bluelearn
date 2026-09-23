import { useCallback } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import type { Connection } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { ContributionType } from "@/types/contributions";
import type { listGuides } from "@/lib/api/guides";
import { useTheme } from "@/lib/themeProvider";

import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";

type ObjectiveGraphNode =
  | {
      id: string;
      type: "guide";
      guideSlug: string;
      position: {
        x: number;
        y: number;
      };
    }
  | {
      id: string;
      type: "guide_request";
      title: string;
      summary: string;
      position: {
        x: number;
        y: number;
      };
    }
  | {
      id: string;
      type: "target";
      guideSlug: string;
      position: {
        x: number;
        y: number;
      };
    };

type ObjectiveGraphEdge = {
  id: string;
  source: string;
  target: string;
  type: "prerequisite";
};

type ObjectiveGraphData = {
  nodes: Array<ObjectiveGraphNode>;
  edges: Array<ObjectiveGraphEdge>;
};

type Guide = Awaited<ReturnType<typeof listGuides>>[number];

type PropTypes = {
  Stepper: any;
  type: ContributionType | null;

  hideBackBtn?: boolean;
  onSaveDraft?: () => void;
  submitting?: boolean;
  guides?: Array<Guide>;
  objectiveGraph?: ObjectiveGraphData;
  setObjectiveGraph?: (graph: ObjectiveGraphData) => void;
};

export const ObjectiveDesign = ({
  Stepper,
  type,
  hideBackBtn,
  onSaveDraft,
  submitting,
  guides,
}: PropTypes) => {
  return (
    <Stepper.Content step="objective-design">
      <StepperActionHeader
        title="Objective Design"
        Stepper={Stepper}
        type={type}
        hideBackBtn={hideBackBtn}
        onSaveDraft={onSaveDraft}
        submitting={submitting}
      />

      <div className="min-h-[calc(100vh-65px)] min-w-0 flex-1 pt-4">
        <ReactFlowProvider>
          <ObjectiveGraph
            // graph={graph}
            guides={guides ?? []}
          />
        </ReactFlowProvider>
      </div>
    </Stepper.Content>
  );
};

type ObjectiveGraphProps = {
  // graph: ObjectiveGraphData;
  guides: Array<Guide>;
};

const ObjectiveGraph = ({ guides }: ObjectiveGraphProps) => {
  const { theme } = useTheme();

  const onNodesChange = useCallback((changes: Array<any>) => {}, []);

  const onConnect = useCallback((connection: Connection) => {}, []);

  return (
    <div className="flex h-[calc(100vh-250px)] min-h-[600px] flex-col">
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
        <ReactFlow
          nodes={[]}
          edges={[]}
          // nodeTypes={}
          onNodesChange={onNodesChange}
          onConnect={onConnect}
          deleteKeyCode={["Backspace", "Delete"]}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          colorMode={theme}
          className="bg-transparent"
          minZoom={0.2}
          maxZoom={1.5}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
};
