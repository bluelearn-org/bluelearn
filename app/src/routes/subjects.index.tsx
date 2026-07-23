import { createFileRoute } from "@tanstack/react-router";

import { Separator } from "@/components/ui/separator";

import { SubjectCard } from "@/components/cards/SubjectCard";
import { Route as SubjectRoute } from "@/routes/subjects.$slug";

import { listSubjects } from "@/lib/api/subjects";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

function SidebarMd({ subjects }: any) {
  // return subjects.map(subject => {
  return (
    <CollapsibleSection
      title={<span className="font-black">G</span>}
      containerStyles=""
    >
      <ul className="ml-8 list-disc">
        <li>Game Development</li>
        <li>Game Development</li>
        <li>Game Development</li>
        <li>Game Development</li>
      </ul>
    </CollapsibleSection>
  );
  // })
}

function SidebarXs() {
  return (
    <div className="w-full">
      <Select>
        <SelectTrigger className="mx-auto w-full max-w-96">
          <SelectValue placeholder="Select a Subject Name" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>G</SelectLabel>
            <SelectItem value="game-development">Game Development</SelectItem>
            <SelectItem value="algebra">Algebra</SelectItem>
            <SelectItem value="geometry">Geometry</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

function Sidebar({ subjects }: any) {
  return (
    <>
      <div className="hidden md:block">
        <SidebarMd />
      </div>
      <div className="md:hidden">
        <SidebarXs />
      </div>
    </>
  );
}

function Subjects({ subjects }: any) {
  if (subjects.length === 0) {
    return <p className="text-sm text-muted-foreground">No subjects yet.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:ml-4 lg:grid-cols-2">
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
  );
}

function RouteComponent() {
  const subjects = Route.useLoaderData();

  return (
    <Shell>
      <section className="grid border-b md:grid-cols-[320px_1fr]">
        <aside className="overflow-y-auto py-6 md:h-[calc(100vh-70px)] md:px-6">
          <Sidebar subjects={subjects} />
        </aside>

        <Subjects subjects={subjects} />
      </section>
    </Shell>
  );
}
