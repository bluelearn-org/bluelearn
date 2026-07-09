import { createFileRoute } from "@tanstack/react-router";

import type { HydratedPath } from "@/types/paths";
import type { Guide } from "@/types/guides";
import type { Subject } from "@/types/subjects";

import { Separator } from "@/components/ui/separator";
import { PathCard } from "@/components/cards/PathCard";
import { GuideCard } from "@/components/cards/GuideCard";
import { CustomTabs } from "@/components/Tabs";
import { SubjectCard } from "@/components/cards/SubjectCard";

import guides from "@/data/guides.json";
import paths from "@/data/paths.json";
import subjects from "@/data/subjects.json";

import { hydratePaths } from "@/lib/getData";

export const Route = createFileRoute("/review/")({ component: RouteComponent });

function RouteComponent() {
  const hydratedPaths: Array<HydratedPath> = hydratePaths(guides, paths);
  const allGuides = hydratedPaths.flatMap((p) => p.levels.map((l) => l.guide));

  const tabs = [
    {
      id: "paths",
      label: "Learning Paths",
      content: <ReviewGrid type="paths" data={hydratedPaths} />,
    },
    {
      id: "guides",
      label: "Guides",
      content: <ReviewGrid type="guides" data={allGuides} />,
    },
    {
      id: "subjects",
      label: "Subjects",
      content: <ReviewGrid type="subjects" data={subjects} />,
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
  if (type == "paths") {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {data.map((d: HydratedPath) => (
          <PathCard key={d.slug} path={d} />
        ))}
      </div>
    );
  } else if (type == "guides") {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {data.map((d: Guide) => (
          <GuideCard key={d.slug} guide={d} />
        ))}
      </div>
    );
  } else if (type == "subjects") {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {data.map((d: Subject) => (
          <SubjectCard key={d.slug} subject={d} />
        ))}
      </div>
    );
  }
};
