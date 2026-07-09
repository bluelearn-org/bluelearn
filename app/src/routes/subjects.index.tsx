import { createFileRoute } from "@tanstack/react-router";

import type { Subject } from "@/types/subjects";

import { Separator } from "@/components/ui/separator";

import { SubjectCard } from "@/components/cards/SubjectCard";
import subjects from "@/data/subjects.json";

export const Route = createFileRoute("/subjects/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="mx-auto max-w-[1280px] border-x bg-background">
      <section className="border-b px-8 py-8 lg:px-16">
        <div className="mb-6">
          <h1 className="data-label text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            Browse By Subjects
          </h1>
        </div>

        <Separator className="mb-4 bg-border" />

        {/* Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {subjects.map((subject: Subject) => {
            const s = {
              ...subject,
              label: "Subjects",
              stats: [
                { label: "Objectives", data: subject.paths_total },
                { label: "Guides", data: subject.guides_total },
              ],
            };
            return <SubjectCard key={s.slug} subject={s} />;
          })}
        </div>
      </section>
    </div>
  );
}
