import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { SubjectsGrid } from "@/components/subjects/SubjectGrid";
import {
  NoSubjectsError,
  SubjectsLoadError,
} from "@/components/subjects/SubjectsError";
import { SubjectSidebar } from "@/components/sidebar/SubjectSidebar";

import { listGroupedSubjects } from "@/lib/api/subjects";
import { buildPageMeta } from "@/lib/seo";

export const Route = createFileRoute("/subjects/")({
  head: () => ({
    meta: buildPageMeta(
      "Subjects",
      "Browse subjects to find free guides and learning objectives on the topics you want to learn."
    ),
  }),
  loader: ({ abortController }) =>
    listGroupedSubjects({ signal: abortController.signal }),
  errorComponent: SubjectsLoadError,
  component: RouteComponent,
});

type SubjectsPageProps = {
  children: React.ReactNode;
};

export const SubjectsPage = ({ children }: SubjectsPageProps) => {
  return (
    <div className="mx-auto max-w-[1280px] bg-background">
      <div className="border-b px-8 py-8 lg:px-16">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            Browse By Subjects
          </h1>
        </div>

        <Separator className="mb-4 bg-border" />

        {children}
      </div>
    </div>
  );
};

function RouteComponent() {
  const groups = Route.useLoaderData();

  const subjects = useMemo(
    () => groups.flatMap((group) => group.subjects),
    [groups]
  );

  const letters = useMemo(() => groups.map((group) => group.char), [groups]);

  const [selectedLetter, setSelectedLetter] = useState("");

  useEffect(() => {
    if (!selectedLetter && letters.length > 0) {
      setSelectedLetter(letters[0]);
    }
  }, [letters, selectedLetter]);

  if (subjects.length === 0) {
    return (
      <SubjectsPage>
        <NoSubjectsError />
      </SubjectsPage>
    );
  }

  return (
    <SubjectsPage>
      <section>
        {/* Desktop */}
        <div className="hidden md:grid md:grid-cols-[320px_1fr] md:items-start">
          <SubjectSidebar groups={groups} />

          <SubjectsGrid subjects={subjects} />
        </div>

        {/* Mobile */}
        <div className="md:hidden">
          <Tabs value={selectedLetter} onValueChange={setSelectedLetter}>
            <TabsList className="flex h-auto min-h-10 w-full justify-start gap-2 overflow-x-auto overflow-y-hidden bg-transparent p-0">
              {letters.map((letter) => (
                <TabsTrigger
                  key={letter}
                  value={letter}
                  className="mono-micro flex h-auto shrink-0 items-center rounded-full border border-border bg-background px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:ring-1 data-[state=active]:ring-primary/20"
                >
                  {letter}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <SubjectsGrid
            subjects={
              groups.find((group) => group.char === selectedLetter)?.subjects ??
              []
            }
          />
        </div>
      </section>
    </SubjectsPage>
  );
}
