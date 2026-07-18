import { createFileRoute } from "@tanstack/react-router";

import { Separator } from "@/components/ui/separator";

import { SubjectCard } from "@/components/cards/SubjectCard";
import { Route as SubjectRoute } from "@/routes/subjects.$slug";

import { listSubjects } from "@/lib/api/subjects";

export const Route = createFileRoute("/subjects/")({
  loader: ({ abortController }) =>
    listSubjects({ signal: abortController.signal }),
  errorComponent: SubjectsError,
  component: RouteComponent,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1280px] border-x bg-background">
      <section className="border-b px-8 py-8 lg:px-16">
        <div className="mb-6">
          <h1 className="data-label text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            Browse By Subjects
          </h1>
        </div>

        <Separator className="mb-4 bg-border" />

        {children}
      </section>
    </div>
  );
}

function SubjectsError() {
  return (
    <Shell>
      <p className="text-sm text-muted-foreground">
        Subjects could not be loaded. Try again shortly.
      </p>
    </Shell>
  );
}

function RouteComponent() {
  const subjects = Route.useLoaderData();

  if (subjects.length === 0) {
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">No subjects yet.</p>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {subjects.map((subject) => {
          const s = {
            ...subject,
            stats: [
              { label: "Objectives", data: subject.objectives_total },
              { label: "Guides", data: subject.guides_total },
            ],
          };
          return <SubjectCard key={s.slug} subject={s} to={SubjectRoute.to} />;
        })}
      </div>
    </Shell>
  );
}
