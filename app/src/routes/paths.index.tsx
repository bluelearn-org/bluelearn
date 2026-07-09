import { createFileRoute } from "@tanstack/react-router";

import type { HydratedPath } from "@/types/paths";

import { Separator } from "@/components/ui/separator";
import { PathCard } from "@/components/cards/PathCard";

import { hydratePaths } from "@/lib/getData";

import guides from "@/data/guides.json";
import objectives from "@/data/objectives.json";

export const Route = createFileRoute("/paths/")({ component: RouteComponent });

function RouteComponent() {
  const hydratedPaths: Array<HydratedPath> = hydratePaths(guides, objectives);

  return (
    <div className="mx-auto max-w-[1280px] border-x bg-background">
      <section className="border-b px-8 py-8 lg:px-16">
        <div className="mb-6">
          <h1 className="data-label text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            Learning Paths
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
    </div>
  );
}
