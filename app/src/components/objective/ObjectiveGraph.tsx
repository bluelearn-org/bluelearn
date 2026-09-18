import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  GuideListItem,
  Objective,
  ObjectiveSnapshot,
} from "@bluelearn/schemas";
import { GuideGraph } from "@/components/graph/GuideGraph";
import { WalkthroughNode } from "@/components/graph/WalkthroughNode";
import { WalkthroughPanel } from "@/components/graph/WalkthroughPanel";
import { buildObjectiveGraph } from "@/lib/objectiveGraph";

const nodeTypes = { walkthroughNode: WalkthroughNode };

type ObjectiveGraphProps = {
  objective: Pick<Objective, "slug" | "title">;
  snapshot: ObjectiveSnapshot;
  guides: Array<GuideListItem>;
};

export function ObjectiveGraph({
  objective,
  snapshot,
  guides,
}: ObjectiveGraphProps) {
  const data = useMemo(
    () => buildObjectiveGraph(snapshot, guides),
    [snapshot, guides]
  );
  const targetSlugs = useMemo(
    () =>
      new Set(
        snapshot.nodes
          .filter((node) => node.is_target)
          .map((node) => node.slug ?? node.guide_base_id)
      ),
    [snapshot]
  );
  const [selectedGuide, setSelectedGuide] = useState<string | null>(null);
  const [hoveredGuide, setHoveredGuide] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const selectedNode =
    data.nodes.find((node) => node.slug === selectedGuide) ??
    data.nodes.find((node) => targetSlugs.has(node.slug)) ??
    data.nodes.at(0);
  const selectedSlug = selectedNode?.slug;
  const getNodeState = useCallback(
    (slug: string) => ({
      isSelected: slug === selectedSlug,
      isTarget: targetSlugs.has(slug),
    }),
    [selectedSlug, targetSlugs]
  );

  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullscreen]);

  if (!selectedNode) {
    return (
      <p className="text-sm text-muted-foreground">
        This objective has no included guides yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col-reverse md:grid md:grid-cols-[320px_1fr]">
      <WalkthroughPanel
        node={selectedNode}
        targetSlug={selectedNode.slug}
        targetTitle={selectedNode.title}
        objective={objective}
        canOpenGuide={snapshot.nodes.some(
          (node) => node.guide_base_id === selectedNode.id && node.slug !== null
        )}
      />
      <div
        className={
          isFullscreen
            ? "fixed inset-0 z-50 bg-background"
            : "h-[500px] min-w-0 overflow-hidden rounded-xl border border-border bg-muted/10"
        }
      >
        <GuideGraph
          walkthroughData={data}
          targetSlug={objective.slug}
          hoveredGuide={hoveredGuide}
          onHoverGuide={setHoveredGuide}
          nodeType="walkthroughNode"
          nodeTypes={nodeTypes}
          getNodeState={getNodeState}
          onNodeClick={setSelectedGuide}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen((value) => !value)}
          showFitView={false}
        />
      </div>
    </div>
  );
}
