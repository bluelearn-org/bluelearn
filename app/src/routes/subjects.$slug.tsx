import { createFileRoute } from "@tanstack/react-router";

import type { HydratedObjective, Level } from "@/types/objectives";

import { Separator } from "@/components/ui/separator";
import { ObjectiveCard } from "@/components/cards/ObjectiveCard";
import { GuideCard } from "@/components/cards/GuideCard";

import { Route as ObjectiveRoute } from "@/routes/objectives.$slug";
import { Route as GuideRoute } from "@/routes/guides.$slug";

import { hydrateObjectives } from "@/lib/getData";

import objectives from "@/data/objectives.json";
import guides from "@/data/guides.json";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/subjects/$slug")({
  component: SubjectPage,
});

function SubjectPage() {
  const { slug } = Route.useParams();

  const hydratedObjectives: Array<HydratedObjective> = hydrateObjectives(
    guides,
    objectives
  );

  const allGuides = hydratedObjectives.flatMap((p) =>
    p.levels.map((l) => l.guide)
  );

  return (
    <div className="mx-auto max-w-[1280px] border-x bg-background">
      <section className="border-b px-8 py-8 lg:px-16">
        <div className="mb-6">
          <h1 className="data-label text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            {slug} Learning Objectives ({hydratedObjectives.length})
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

      <section className="border-b px-8 py-8 lg:px-16">
        <div className="mb-6">
          <h1 className="data-label text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            {slug} Guides ({allGuides.length})
          </h1>
        </div>

        <Separator className="mb-4 bg-border" />

        {/* Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {hydratedObjectives[0].levels.map((level: Level) => {
            const g = {
              ...level.guide,
              stats: [{ label: "Duration", data: level.guide.duration }],
              actionBtns: (
                <div className="col-span-2 col-start-3 mt-5 flex items-center justify-around border-t-1 p-4 pt-8 lg:mt-0 lg:border-none lg:pt-4">
                  <Button variant="outline" className="btn-sec" size="lg">
                    View Walkthrough
                  </Button>

                  <Button className="btn-pri" size="lg">
                    Read
                  </Button>
                </div>
              ),
            };
            return (
              <GuideCard
                key={g.slug}
                guide={g}
                origin={{
                  type: "subject",
                  title: slug,
                  path: `/subjects/${slug}`,
                }}
                to={GuideRoute.to}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
