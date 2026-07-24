import { Link, createFileRoute, notFound } from "@tanstack/react-router";

import type { HydratedObjective } from "@/types/objectives";

import { Separator } from "@/components/ui/separator";

import { getPathBySlug, hydrateObjectives } from "@/lib/getData";
import { formatDuration } from "@/lib/guideUtils";

import objectives from "@/data/objectives.json";
import guides from "@/data/guides.json";

import ObjectiveFlow from "@/components/objective/ObjectiveFlow";

export const Route = createFileRoute("/objectives/$slug/")({
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
      guides: objective.targets,
    },
  ];

  return (
    <div className="mx-auto max-w-[1280px] border-x bg-background">
      <section className="border-b px-8 py-8 lg:px-16">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            Objective: {objective.title} ({objective.targets.length} targets |{" "}
            {formatDuration(objective.duration)} total)
          </h1>

          <Link
            to="/objectives/$slug/graph"
            params={{ slug }}
            className="btn-sec inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium whitespace-nowrap ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
          >
            See Graph View
          </Link>
        </div>

        <Separator className="mb-4 bg-border" />

        <ObjectiveFlow objective={objective} targets={targets} />
      </section>
    </div>
  );
}
