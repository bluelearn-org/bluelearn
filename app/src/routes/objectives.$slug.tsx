import { createFileRoute, notFound } from "@tanstack/react-router";

import type { HydratedObjective } from "@/types/objectives";

import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

import { getPathBySlug, hydrateObjectives } from "@/lib/getData";
import { formatDuration } from "@/lib/guideUtils";

import objectives from "@/data/objectives.json";
import guides from "@/data/guides.json";

import ObjectiveFlow from "@/components/objective/ObjectiveFlow";

export const Route = createFileRoute("/objectives/$slug")({
  component: PathPage,
});

function PathPage() {
  const { slug } = Route.useParams();
  const pathData = getPathBySlug(objectives, slug);

  if (!pathData) {
    throw notFound();
  }

  const hydratedObjectives: Array<HydratedObjective> = hydrateObjectives(
    guides,
    [pathData]
  );

  const objective = hydratedObjectives[0];

  const targets = [
    {
      slug: "target-1",
      title: "Target 1",
      summary: "Target 1 Summary",
      guides: objective.levels,
    },
    {
      slug: "target-2",
      title: "Target 2",
      summary: "Target 2 Summary",
      guides: objective.levels,
    },
    {
      slug: "target-3",
      title: "Target 3",
      summary: "Target 3 Summary",
      guides: objective.levels,
    },
  ];

  return (
    <div className="mx-auto max-w-[1280px] border-x bg-background">
      <section className="border-b px-8 py-8 lg:px-16">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            Objective: {objective.title} ({objective.levels.length} levels |{" "}
            {formatDuration(objective.duration)} total)
          </h1>

          <Button variant="outline" className="btn-sec" size="lg">
            See Graph View
          </Button>
        </div>

        <Separator className="mb-4 bg-border" />

        <ObjectiveFlow objective={objective} targets={targets} />
      </section>
    </div>
  );
}
