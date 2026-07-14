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
  const objective = hydratedObjectives[0];

  return (
    <div className="mx-auto max-w-[1280px] border-x bg-background">
      <section className="border-b px-8 py-8 lg:px-16">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h1 className="data-label text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            Objective: {objective.title} ({objective.levels.length} levels |{" "}
            {formatDuration(objective.duration)} total)
          </h1>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="h-9 rounded-full">
              See Graph View
            </Button>

            <select
              aria-label="Sub Objective"
              className="h-9 min-w-[140px] rounded-full border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="">Sub Objective</option>
              <option value={slug}>{objective.title}</option>
            </select>
          </div>
        </div>

        <Separator className="mb-4 bg-border" />

        <ol className="m-0 flex w-full list-none flex-col gap-3 p-0">
          {objective.levels.map((level: Level, index: number) => {
            const g = {
              ...level.guide,
              stats: [{ label: "Duration", data: level.guide.duration }],
              actionBtns: (
                <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
                  <Button
                    variant="outline"
                    className="btn-sec h-10 rounded-full"
                    size="lg"
                  >
                    View Walkthrough
                  </Button>

                  <Button className="btn-pri h-10 rounded-full" size="lg">
                    Read
                  </Button>
                </div>
              ),
            };
            return (
              <li
                key={g.slug}
                className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-badge-border bg-badge font-mono text-base font-semibold text-badge-foreground">
                  {index + 1}
                </div>

                <div className="w-full min-w-0 flex-1">
                  <GuideCard
                    guide={g}
                    origin={{
                      type: "objective",
                      title: objective.title,
                      path: `/objectives/${slug}`,
                    }}
                    to={GuideRoute.to}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
