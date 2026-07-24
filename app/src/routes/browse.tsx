import { createFileRoute } from "@tanstack/react-router";
import { Search, SlidersHorizontal, X } from "lucide-react";

import type { HydratedObjective } from "@/types/objectives";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ObjectiveCard } from "@/components/cards/ObjectiveCard";

import { Route as ObjectiveRoute } from "@/routes/objectives/$slug/index";
import { Route as GuideRoute } from "@/routes/guides/$slug/index";

import { hydrateObjectives } from "@/lib/getData";

import objectives from "@/data/objectives.json";
import guides from "@/data/guides.json";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { Pagination } from "@/components/Pagination";
import { GuideCard } from "@/components/cards/GuideCard";

export const Route = createFileRoute("/browse")({
  component: RouteComponent,
});

function RouteComponent() {
  const hydratedObjectives: Array<HydratedObjective> = hydrateObjectives(
    guides,
    objectives
  );

  const allGuides = hydratedObjectives.flatMap((o) => o.targets).slice(0, 6);

  const sectionHeadingCommonClassNames =
    "font-mono text-[12px] uppercase tracking-[0.08em] text-muted-foreground ml-1";

  return (
    <div className="mx-auto max-w-[1280px] border-x bg-background">
      <section className="border-b px-8 py-10 lg:px-16">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            Browse
          </h1>
        </div>

        <Separator className="mb-8 bg-border" />

        <div className="flex gap-3">
          <div className="relative flex-1 rounded-md">
            <Search className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              placeholder="Search guides, concepts, topics..."
              className="h-14 pr-12 pl-11 text-base"
            />

            <button className="absolute top-1/2 right-3 -translate-y-1/2 p-1 text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>

          <Button
            variant="outline"
            size="icon"
            className="h-14 w-14 rounded-md border"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>

          <Button className="btn-pri h-14 px-8">Search</Button>
        </div>
      </section>

      {/* Objectives */}
      <section className="px-8 py-10 lg:px-16">
        <CollapsibleSection
          title={
            <h2 className={`${sectionHeadingCommonClassNames}`}>
              Learning Objectives ({objectives.length})
            </h2>
          }
          defaultOpen={true}
        >
          <Separator className="mb-8 h-[0.5px]! bg-border" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {hydratedObjectives.map((objective: HydratedObjective) => (
              <ObjectiveCard
                key={objective.slug}
                objective={objective}
                to={ObjectiveRoute.to}
              />
            ))}
          </div>
          <div className="mt-8 mb-4">
            <Pagination
              activePageNo={6}
              onPageSelect={() => {}}
              toFirst={() => {}}
              onPrevious={() => {}}
              onNext={() => {}}
              toLast={() => {}}
              totalPages={10}
            />
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
          <div className="grid gap-6 md:grid-cols-2">
            {allGuides.map((guide, index) => (
              <GuideCard key={index} guide={guide} to={GuideRoute.to} />
            ))}
          </div>
          <div className="mt-8 mb-4">
            <Pagination
              activePageNo={6}
              onPageSelect={() => {}}
              toFirst={() => {}}
              onPrevious={() => {}}
              onNext={() => {}}
              toLast={() => {}}
              totalPages={10}
            />
          </div>
        </CollapsibleSection>
      </section>
    </div>
  );
}
