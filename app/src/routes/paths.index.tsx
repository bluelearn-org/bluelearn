import { createFileRoute } from "@tanstack/react-router"

import type { HydratedPath } from "@/types/paths"

import { Separator } from "@/components/ui/separator"
import { PathCard } from "@/components/cards/PathCard"

import { hydratePaths } from "@/lib/getData"

import guides from "@/data/guides.json"
import paths from "@/data/paths.json"


export const Route = createFileRoute("/paths/")({ component: RouteComponent })

function RouteComponent() {
  const hydratedPaths: Array<HydratedPath> = hydratePaths(guides, paths);
  
  return (
    <div className="mx-auto max-w-[1280px] border-x bg-background">
      <section className="border-b px-8 py-8 lg:px-16">
        <div className="mb-6">
          <h1 className="data-label text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            Learning Paths
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
    </div>
  )
}
