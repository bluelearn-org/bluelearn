import { createFileRoute, notFound } from "@tanstack/react-router"

import type { HydratedPath, Level } from "@/types/paths"

import { Separator } from "@/components/ui/separator"
import { GuideCard } from "@/components/cards/GuideCard"

import { getPathBySlug, hydratePaths } from "@/lib/getData";
import { formatDuration } from "@/lib/guideUtils";

import paths from "@/data/paths.json"
import guides from "@/data/guides.json"

export const Route = createFileRoute("/paths/$slug")({ component: PathPage })

function PathPage() {
  const { slug } = Route.useParams()
  const pathData = getPathBySlug(paths, slug);

  if (!pathData) { throw notFound }

  const hydratedPaths: Array<HydratedPath> = hydratePaths(guides, [pathData]);

  return (
    <div className="mx-auto max-w-[1280px] border-x bg-background">
      <section className="border-b px-8 py-8 lg:px-16">
        <div className="mb-6">
          <p className="data-label text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            Learning Path: {slug} ({hydratedPaths[0].levels.length} levels | {formatDuration(hydratedPaths[0].duration)} total)
          </p>
        </div>
        
        <Separator className="mb-4 bg-border" />
        
        {/* Grid */}
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
          {hydratedPaths[0].levels.map((level: Level) => (
            <GuideCard key={level.guide.slug} guide={level.guide} level={level.level} />
          ))}
        </div>
      </section>
    </div>
  )
}
