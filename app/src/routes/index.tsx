import { Link, createFileRoute } from "@tanstack/react-router";
import { ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";

import type { HydratedObjective } from "@/types/objectives";

import { Route as SubjectRoute } from "@/routes/subjects.$slug";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FeaturedRow } from "@/components/FeaturedRow";

import subjects from "@/data/subjects.json";
import objectives from "@/data/objectives.json";
import guides from "@/data/guides.json";

import { hydrateObjectives } from "@/lib/getData";

export const Route = createFileRoute("/")({ component: RouteComponent });

function RouteComponent() {
  const hydratedObjectives: Array<HydratedObjective> = hydrateObjectives(
    guides,
    objectives
  );

  return (
    <div className="mx-auto max-w-[1280px] border-x bg-background">
      {/* Hero */}
      <section className="border-b">
        <div className="grid items-center gap-12 px-8 py-16 lg:grid-cols-[1fr_320px] lg:px-16">
          {/* Left */}
          <div>
            <p className="mb-3 font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
              Browse Knowledge
            </p>
            <h1 className="max-w-3xl text-4xl font-bold tracking-[-0.04em] lg:text-6xl">
              Welcome to{" "}
              <span className="text-brand-blue italic">BlueLearn</span>,
              <br />
              have a look around...
            </h1>
            <p className="mt-6 max-w-xl font-mono text-sm text-muted-foreground">
              anything and everything you think of can be found
              <span className="font font-bold text-brand-blue">*</span>
            </p>
          </div>
          {/* Right */}
          <div className="flex flex-col items-end">
            <div className="aspect-[4/3] w-full overflow-hidden rounded-lg border bg-muted">
              <img
                src="/assets/hero.png"
                alt="BlueLearn"
                className="h-full w-full object-cover"
              />
            </div>

            <p className="mt-3 text-right font-mono text-xs tracking-[0.08em] text-muted-foreground">
              <span className="font-bold text-brand-blue">*</span>can't find
              your subject area,
              <br />
              contribute a guide
            </p>
          </div>
        </div>
      </section>
      <section className="border-b px-8 py-10 lg:px-16">
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

      <section className="border-b px-8 py-8 lg:px-16">
        <div className="mb-6">
          <p className="data-label text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
            Browse Subjects
          </p>
        </div>

        <Separator className="mb-4 bg-border" />

        <div className="flex flex-wrap gap-3">
          {[...subjects]
            .sort((a, b) => a.name.localeCompare(b.name))
            .slice(0, 24)
            .map((subject) => (
              <Link
                to={SubjectRoute.to}
                params={{ slug: subject.slug }}
                key={subject.slug}
              >
                <Badge
                  variant="outline"
                  className="mono-micro rounded-full border p-4 tracking-[0.08em] transition-colors hover:bg-badge"
                >
                  {subject.name}
                </Badge>
              </Link>
            ))}
        </div>

        {subjects.length > 24 && (
          <div className="flex justify-center">
            <Link
              to="/subjects"
              className="mono-micro inline-flex items-center justify-center p-4 tracking-[0.08em] text-muted-foreground uppercase transition-colors hover:text-foreground"
            >
              Show More Subjects
              <ChevronRight />
            </Link>
          </div>
        )}
      </section>

      {/* Featured Section */}
      <FeaturedRow objectives={hydratedObjectives} type={"Recently Added"} />
      <FeaturedRow objectives={hydratedObjectives} type={"Popular This Week"} />
    </div>
  );
}
