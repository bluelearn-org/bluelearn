import { createFileRoute } from "@tanstack/react-router";

import type { HydratedPath, Level } from "@/types/paths";

import { Separator } from "@/components/ui/separator";
import { PathCard } from "@/components/cards/PathCard";
import { GuideCard } from "@/components/cards/GuideCard";

import { hydratePaths } from "@/lib/getData";

import objectives from "@/data/objectives.json";
import guides from "@/data/guides.json";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/subjects/$slug")({
  component: SubjectPage,
});

function SubjectPage() {
  const { slug } = Route.useParams();

  const hydratedPaths: Array<HydratedPath> = hydratePaths(guides, objectives);

  const allGuides = hydratedPaths.flatMap((p) => p.levels.map((l) => l.guide));

  return (
    <div className="mx-auto max-w-[1280px] border-x bg-background">
      <section className="border-b px-8 py-8 lg:px-16">
        <div className="mb-6">
          <h1 className="data-label text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            {slug} Learning Paths ({hydratedPaths.length})
          </h1>
        </div>

        <Separator className="mb-4 bg-border" />

        {/* Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {hydratedPaths.map((path: HydratedPath) => {
            const p = {
              ...path,
              stats: [
                { label: "Duration", data: path.duration },
                { label: "Guides", data: path.levels.length },
              ],
            };
            return <PathCard key={p.slug} path={p} />;
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
          {hydratedPaths[0].levels.map((level: Level) => {
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
            return <GuideCard key={g.slug} guide={g} />;
          })}
        </div>
      </section>
    </div>
  );
}
