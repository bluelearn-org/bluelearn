import { createFileRoute } from "@tanstack/react-router";

import type { HydratedObjective } from "@/types/objectives";
import type { Guide } from "@/types/guides";

import { Separator } from "@/components/ui/separator";
import { ObjectiveCard } from "@/components/cards/ObjectiveCard";
import { GuideCard } from "@/components/cards/GuideCard";
import { CustomTabs } from "@/components/Tabs";

import { Route as ReviewSlugRoute } from "@/routes/review.$slug";

import guides from "@/data/guides.json";
import objectives from "@/data/objectives.json";

import { hydrateObjectives } from "@/lib/getData";

export const Route = createFileRoute("/review/")({ component: RouteComponent });

function RouteComponent() {
  const hydratedObjectives: Array<HydratedObjective> = hydrateObjectives(
    guides,
    objectives
  );
  const allGuides: Array<Guide> = hydratedObjectives.flatMap((p) =>
    p.levels.map((l) => l.guide)
  );

  const tabs = [
    {
      id: "guides",
      label: "Guides",
      content: <ReviewGrid type="guides" data={allGuides} />,
    },
    {
      id: "objectives",
      label: "Learning Objectives",
      content: <ReviewGrid type="objectives" data={hydratedObjectives} />,
    },
  ];

  return (
    <div className="mx-auto max-w-[1280px] border-x bg-background">
      <section className="border-b px-8 py-8 lg:px-16">
        <div className="mb-6">
          <h1 className="data-label text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            Review Queue
          </h1>
        </div>

        <Separator className="mb-4 bg-border" />

        <CustomTabs tabs={tabs} />
      </section>
    </div>
  );
}

type ReviewGridProps = {
  type: string;
  data: any;
};

const ReviewGrid = ({ type, data }: ReviewGridProps) => {
  if (type == "objectives") {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {data.map((objective: HydratedObjective, index: number) => {
          const o = {
            ...objective,
          };
          return (
            <ObjectiveCard key={index} objective={o} to={ReviewSlugRoute.to} />
          );
        })}
      </div>
    );
  } else if (type == "guides") {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {data.map((guide: Guide, index: number) => {
          return (
            <GuideCard key={index} guide={guide} to={ReviewSlugRoute.to} />
          );
        })}
      </div>
    );
  }
};
