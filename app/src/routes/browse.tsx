import { createFileRoute } from "@tanstack/react-router";
import { Search, SlidersHorizontal, X } from "lucide-react";

import type { HydratedPath } from "@/types/paths";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { PathCard } from "@/components/cards/PathCard";

import { hydratePaths } from "@/lib/getData";

import paths from "@/data/paths.json"
import guides from "@/data/guides.json"
import { CollapsibleSection } from "@/components/CollapsibleSection";


export const Route = createFileRoute("/browse")({
  component: RouteComponent,
});

function RouteComponent() {
  const hydratedPaths: Array<HydratedPath> = hydratePaths(guides, paths);

  const allGuides = hydratedPaths.flatMap((p) => 
    p.levels.map((l) => l.guide)
  );

  const sectionHeadingCommonClassNames = "font-mono text-[12px] uppercase tracking-[0.08em] text-muted-foreground ml-1";

  return (
    <div className="mx-auto max-w-[1280px] border-x bg-background">
      <section className="border-b px-8 py-10 lg:px-16">
        <div className="mb-6">
          <h1 className="data-label text-[14px] uppercase tracking-[0.08em] text-muted-foreground">
            Browse
          </h1>
        </div>

        <Separator className="mb-8 bg-border" />

        <div className="flex gap-3">
          <div className="relative flex-1 rounded-md">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              placeholder="Search guides, concepts, topics..."
              className="h-14 pl-11 pr-12 text-base"
            />

            <button className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>

          <Button variant="outline" size="icon" className="h-14 w-14 rounded-md border">
            <SlidersHorizontal className="h-4 w-4" />
          </Button>

          <Button className="h-14 px-8 btn-pri">Search</Button>
        </div>
      </section>

      {/* Paths */}
      <section className="px-8 py-10 lg:px-16">
        <CollapsibleSection 
          title={
            <h2 className={`${sectionHeadingCommonClassNames}`}>
              Learning Paths ({paths.length})
            </h2>
          }
          defaultOpen={true}
        >
          <Separator className="mb-8 bg-border" />
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            {hydratedPaths.map((path: HydratedPath) => (
              <PathCard key={path.slug} path={path} />
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title={
            <h2 className={`${sectionHeadingCommonClassNames}`}>
              Guides ({allGuides.length})
            </h2>
          }
          defaultOpen={true}
        >
          <Separator className="mb-8 bg-border" />
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {/* {allGuides.map((guide, index) => (
              <GuideCard key={index} guide={guide} />
            ))} */}
          </div>
        </CollapsibleSection>
      </section>
    </div>
  );
}
