import type { GraphNodeData } from "@/lib/useGraphLayout";
import { GuideGraphNode } from "@/components/graph/GuideGraphNode";

// isSelected comes from getNodeState; isRequest only from an objective's graph.
type WalkthroughNodeData = GraphNodeData & {
  isSelected: boolean;
  isRequest?: boolean;
};

export function WalkthroughNode({ data }: { data: WalkthroughNodeData }) {
  return (
    <GuideGraphNode
      data={data}
      isSelected={data.isSelected}
      isRequest={data.isRequest}
    />
  );
}
