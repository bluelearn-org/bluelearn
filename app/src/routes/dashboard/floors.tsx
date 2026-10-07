import { createFileRoute, useRouter } from "@tanstack/react-router";

import { SubjectFloorEditor } from "@/components/dashboard/SubjectFloorEditor";
import { Combobox } from "@/components/ui/combobox";
import { FieldLabel } from "@/components/ui/field";
import { listGuides } from "@/lib/api/guides";
import {
  getSubjectFloor,
  listSubjects,
  setSubjectFloor,
} from "@/lib/api/subjects";
import { parseSubjectSearch } from "@/lib/walkthroughScope";

export const Route = createFileRoute("/dashboard/floors")({
  validateSearch: parseSubjectSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps, abortController }) => {
    const { signal } = abortController;
    const [subjects, guides, floor] = await Promise.all([
      listSubjects({ signal }),
      listGuides({ signal }),
      deps.subject ? getSubjectFloor(deps.subject, { signal }) : [],
    ]);
    return { subjects, guides, floor };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { subjects, guides, floor } = Route.useLoaderData();
  const { subject } = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const current = subjects.find((candidate) => candidate.slug === subject);

  return (
    <div className="space-y-5">
      <header className="space-y-1.5 border-b border-border pb-5">
        <h1 className="font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
          Subject Floors
        </h1>
        <p className="text-xs text-muted-foreground">
          A subject's prerequisite floor is what its readers are assumed to know
          already. Walkthroughs scoped to the subject stop there instead of
          climbing to every primitive.
        </p>
      </header>

      <section className="max-w-2xl space-y-5">
        <div className="space-y-2">
          <FieldLabel className="mono-micro text-muted-foreground">
            Subject
          </FieldLabel>
          <Combobox
            items={subjects.map((candidate) => ({
              value: candidate.slug,
              label: candidate.name,
              description: candidate.summary ?? undefined,
            }))}
            value={subject ?? ""}
            onValueChange={(slug) => navigate({ search: { subject: slug } })}
          />
        </div>

        {current ? (
          <SubjectFloorEditor
            key={current.slug}
            subjectName={current.name}
            floor={floor}
            guides={guides}
            onSave={async (ids) => {
              await setSubjectFloor(current.slug, ids);
              await router.invalidate();
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Pick a subject to see and edit its floor.
          </p>
        )}
      </section>
    </div>
  );
}
