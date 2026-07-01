import { createFileRoute } from "@tanstack/react-router"

import type { HydratedPath } from "@/types/paths"

import { Separator } from "@/components/ui/separator"
import { PathCard } from "@/components/cards/PathCard"
import { GuideCard } from "@/components/cards/GuideCard"

import { hydratePaths } from "@/lib/getData"

import paths from "@/data/paths.json"
import guides from "@/data/guides.json"


export const Route = createFileRoute("/subjects/$slug")({ component: SubjectPage })

function SubjectPage() {
  const { slug } = Route.useParams();

  const hydratedPaths: Array<HydratedPath> = hydratePaths(guides, paths);

  const allGuides = hydratedPaths.flatMap((p) =>
    p.levels.map((l) => l.guide)
  );

  return (
    <div className="mx-auto max-w-[1280px] border-x bg-background">
      <section className="border-b px-8 py-8 lg:px-16">
        <div className="mb-6">
          <h1 className="data-label text-[14px] uppercase tracking-[0.08em] text-muted-foreground">
            {slug} Learning Paths ({hydratedPaths.length})
          </h1>
        </div>

        <Separator className="mb-4 bg-border" />

        {/* Grid */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          {hydratedPaths.map((path: HydratedPath) => (
            <PathCard key={path.slug} path={path} />
          ))}
        </div>
      </section>

      <section className="border-b px-8 py-8 lg:px-16">
        <div className="mb-6">
          <h1 className="data-label text-[14px] uppercase tracking-[0.08em] text-muted-foreground">
            {slug} Guides ({allGuides.length})
          </h1>
        </div>

        <Separator className="mb-4 bg-border" />

        {/* Grid */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          {allGuides.map((guide) => (
            <GuideCard key={guide.slug} guide={guide} />
          ))}
        </div>
      </section>
    </div>
  )
}