import { createFileRoute } from "@tanstack/react-router";

import type { HydratedObjective } from "@/types/objectives";
import type { Guide } from "@/types/guides";
import type { Subject } from "@/types/subjects";

import { Separator } from "@/components/ui/separator";
import { ObjectiveCard } from "@/components/cards/ObjectiveCard";
import { GuideCard } from "@/components/cards/GuideCard";
import { CustomTabs } from "@/components/Tabs";
import { SubjectCard } from "@/components/cards/SubjectCard";

import guides from "@/data/guides.json";
import objectives from "@/data/objectives.json";
import subjects from "@/data/subjects.json";

import { hydrateObjectives } from "@/lib/getData";
import { Button } from "@/components/ui/button";

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
      id: "subjects",
      label: "Subjects",
      content: <ReviewGrid type="subjects" data={subjects} />,
    },
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
        {data.map((objective: HydratedObjective) => {
          const o = {
            ...objective,
          };
          return <ObjectiveCard key={o.slug} objective={o} />;
        })}
      </div>
    );
  } else if (type == "guides") {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {data.map((guide: Guide) => {
          return <GuideCard key={guide.slug} guide={guide} />;
        })}
      </div>
    );
  } else if (type == "subjects") {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {data.map((subject: Subject) => {
          const s = {
            ...subject,
            stats: [
              { label: "Objectives", data: subject.paths_total },
              { label: "Guides", data: subject.guides_total },
            ],
            actionBtns: (
              <div className="col-span-2 mt-5 flex items-center justify-around border-t-1 p-4 pt-8 lg:mt-0 lg:border-none lg:pt-4">
                <Button variant="destructive" size="lg">
                  Reject
                </Button>

                <Button className="btn-pri" size="lg">
                  Approve
                </Button>
              </div>
            ),
          };
          return <SubjectCard key={s.slug} subject={s} />;
        })}
      </div>
    );
  }
};
