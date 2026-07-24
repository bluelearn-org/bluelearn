import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";

import type { GraphData } from "@/lib/graphUtils";
import { Separator } from "@/components/ui/separator";

import { Route as ObjectiveRoute } from "@/routes/objectives/$slug/index";

import { getPathBySlug } from "@/lib/getData";
import { ObjectiveGraph } from "@/components/graph-view/ObjectiveGraph";
import { fetchObjectiveGraph } from "@/lib/graphUtils";

import objectives from "@/data/objectives.json";
import guidesData from "@/data/guides.json";

export const Route = createFileRoute("/objectives/$slug/graph")({
  component: RouteComponent,
});

function RouteComponent() {
  const { slug } = Route.useParams();

  const objective = getPathBySlug(objectives, slug);
  const [hoveredGuide, setHoveredGuide] = useState<string | null>(null);
  const [focusedTarget, setFocusedTarget] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [graphData, setGraphData] = useState<GraphData | null>(null);

  useEffect(() => {
    fetchObjectiveGraph(slug).then(setGraphData).catch(console.error);
  }, [slug]);

  if (!objective) {
    throw notFound();
  }

  // Get full guide objects for the targets to display titles in the toolbar
  const targetGuides = useMemo(() => {
    return objective.targets
      .map((target: any) => {
        const guide = guidesData.find((g) => g.slug === target.guide);
        if (!guide) return null;
        return {
          ...guide,
          subobjectives: target.subobjectives,
        };
      })
      .filter((g): g is NonNullable<typeof g> => Boolean(g));
  }, [objective]);

  return (
    <div className="mx-auto h-[calc(100vh-70px)] max-w-[1280px] overflow-y-auto border-x bg-background">
      <section className="flex h-full flex-col px-10 py-4 lg:px-16">
        {/* MAIN */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            Graph View: {objective.title}
          </h1>
          {/* Actions */}
          <div className="flex shrink-0 items-center gap-2">
            <Link
              to={ObjectiveRoute.to}
              params={{ slug: slug }}
              className="btn-outline"
            >
              View Objective
            </Link>
          </div>
        </div>

        <Separator className="mb-4" />

        {/* Graph */}
        <div
          className={
            isFullscreen
              ? "fixed inset-0 z-50 bg-background"
              : "min-h-[600px] w-full flex-1 overflow-hidden rounded-xl border border-border bg-muted/10"
          }
        >
          {graphData && (
            <ObjectiveGraph
              walkthroughData={graphData}
              targetSlug={focusedTarget || objective.targets[0]?.guide || ""}
              hoveredGuide={hoveredGuide || focusedTarget}
              onHoverGuide={setHoveredGuide}
              focusedTarget={focusedTarget}
              onFocusTarget={setFocusedTarget}
              targetGuides={targetGuides}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
            />
          )}
        </div>
      </section>
    </div>
  );
}
