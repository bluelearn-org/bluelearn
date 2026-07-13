import { createFileRoute, notFound } from "@tanstack/react-router";

import type { HydratedObjective, Level } from "@/types/objectives";

import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { GuideCard } from "@/components/cards/GuideCard";

import { getPathBySlug, hydrateObjectives } from "@/lib/getData";
import { formatDuration } from "@/lib/guideUtils";

import objectives from "@/data/objectives.json";
import guides from "@/data/guides.json";

import { Route as GuideRoute } from "@/routes/guides.$slug";

export const Route = createFileRoute("/objectives/$slug")({
  component: PathPage,
});

function PathPage() {
  const { slug } = Route.useParams();
  const pathData = getPathBySlug(objectives, slug);

  if (!pathData) {
    throw notFound;
  }

  const hydratedObjectives: Array<HydratedObjective> = hydrateObjectives(
    guides,
    [pathData]
  );

  return (
    <div className="mx-auto max-w-[1280px] border-x bg-background">
      <section className="border-b px-8 py-8 lg:px-16">
        <div className="mb-6">
          <p className="data-label text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
            {/* FIX: should be title not slug */}
            Objective: {slug} ({hydratedObjectives[0].levels.length} levels |{" "}
            {formatDuration(hydratedObjectives[0].duration)} total)
          </p>
        </div>

        <Separator className="mb-4 bg-border" />

        {/* Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {hydratedObjectives[0].levels.map((level: Level) => {
            const g = {
              ...level.guide,
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
                  type: "objective",
                  title: hydratedObjectives[0].title,
                  path: `/objectives/${slug}`,
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
