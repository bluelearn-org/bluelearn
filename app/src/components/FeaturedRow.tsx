import type { HydratedObjective } from "@/types/objectives";

import { Separator } from "@/components/ui/separator";
import { ObjectiveCard } from "@/components/cards/ObjectiveCard";

import { Route as ObjectiveRoute } from "@/routes/objectives/$slug/index";

type PropTypes = {
  objectives: Array<HydratedObjective>;
  type: string;
};

export const FeaturedRow = ({ objectives, type }: PropTypes) => {
  return (
    <section className="border-b px-8 py-10 lg:px-16">
      {/* Header */}
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="data-label text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
            {type}
          </p>
        </div>
      </div>

      <Separator className="mb-4 bg-border" />

      {/* Objectives */}
      <div className="flex scrollbar-thin gap-6 overflow-x-auto p-2">
        {objectives.map((objective: HydratedObjective) => {
          const o = {
            ...objective,
            stats: [
              { label: "Duration", data: objective.duration },
              { label: "Targets", data: objective.targets.length },
            ],
          };
          return (
            <div
              key={objective.slug}
              className="w-[calc(100vw_-_8rem)] shrink-0 sm:w-[550px]"
            >
              <ObjectiveCard
                key={o.slug}
                objective={o}
                to={ObjectiveRoute.to}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
};
