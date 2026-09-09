import type { GraphNodeData } from "@/lib/useGraphLayout";
import { GuideGraphNode } from "@/components/graph/GuideGraphNode";

// isSelected comes from WalkthroughGraph's getNodeState.
type WalkthroughNodeData = GraphNodeData & { isSelected: boolean };

export function WalkthroughNode({ data }: { data: WalkthroughNodeData }) {
  return <GuideGraphNode data={data} isSelected={data.isSelected} />;
}
