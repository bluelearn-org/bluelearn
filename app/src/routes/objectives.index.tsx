import { createFileRoute } from "@tanstack/react-router";

import type { HydratedObjective } from "@/types/objectives";

import { Separator } from "@/components/ui/separator";
import { ObjectiveCard } from "@/components/cards/ObjectiveCard";

import { Route as ObjectiveRoute } from "@/routes/objectives.$slug";

import { hydrateObjectives } from "@/lib/getData";

import guides from "@/data/guides.json";
import objectives from "@/data/objectives.json";

export const Route = createFileRoute("/objectives/")({
  component: RouteComponent,
});

function RouteComponent() {
  const hydratedObjectives: Array<HydratedObjective> = hydrateObjectives(
    guides,
    objectives
  );

  return (
    <div className="mx-auto max-w-[1280px] border-x bg-background">
      <section className="border-b px-8 py-8 lg:px-16">
        <div className="mb-6">
          <h1 className="data-label text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            Objectives
          </h1>
        </div>

        <Separator className="mb-4 bg-border" />

        {/* Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {hydratedObjectives.map((objective: HydratedObjective) => {
            const p = {
              ...objective,
              stats: [
                { label: "Duration", data: objective.duration },
                { label: "Guides", data: objective.levels.length },
              ],
            };
            return (
              <ObjectiveCard
                key={p.slug}
                objective={p}
                to={ObjectiveRoute.to}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
