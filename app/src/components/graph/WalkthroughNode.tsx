import { Layers } from "lucide-react";
import type { GraphNodeData } from "@/lib/useGraphLayout";
import { GuideGraphNode } from "@/components/graph/GuideGraphNode";

// isSelected comes from WalkthroughGraph's getNodeState.
type WalkthroughNodeData = GraphNodeData & { isSelected: boolean };

// A floor guide marks where a subject-scoped climb stops: assumed knowledge,
// with its own prerequisites left out.
function FloorBadge() {
  return (
    <span
      className="mono-micro absolute -top-2.5 right-3 flex items-center gap-1 rounded-full border border-badge-border bg-badge px-2 py-0.5 tracking-[0.08em] text-badge-foreground"
      title="In the subject's prerequisite floor: assumed knowledge, not expanded"
    >
      <Layers className="h-3 w-3" aria-hidden />
      Floor
    </span>
  );
}

export function WalkthroughNode({ data }: { data: WalkthroughNodeData }) {
  return (
    <GuideGraphNode
      data={data}
      isSelected={data.isSelected}
      badge={data.is_floor ? <FloorBadge /> : undefined}
    />
  );
}
