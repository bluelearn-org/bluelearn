import { useState } from "react";
import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import type { DashboardSubject } from "@bluelearn/schemas";
import { fetchSubjectsTable } from "@/lib/api/dashboard";
import { ApiError } from "@/lib/api/apiHelpers";
import {
  dashboardQuery,
  parseDashboardSearch,
  useDashboardSearch,
  usePageSelection,
} from "@/lib/dashboardFilters";
import {
  SubjectsTable,
  subjectColumns,
} from "@/components/tables/SubjectsTable";
import { DashboardPagination } from "@/components/tables/DashboardPagination";
import { ManageSubjectsDialog } from "@/components/subjects/ManageSubjectsDialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard/subjects")({
  validateSearch: parseDashboardSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps, abortController }) => {
    try {
      return await fetchSubjectsTable(dashboardQuery(subjectColumns, deps), {
        signal: abortController.signal,
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) throw notFound();
      throw error;
    }
  },
  component: SubjectsPage,
});

function SubjectsPage() {
  const subjects = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const { filters, updateFilters } = useDashboardSearch(search, (next) =>
    navigate({ search: next, replace: true })
  );
  const [selectedIds, setSelectedIds] = usePageSelection(subjects);
  const [editing, setEditing] = useState<Array<DashboardSubject> | null>(null);
  const selected = subjects.data.filter(({ id }) => selectedIds.has(id));
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <h1 className="font-mono text-sm tracking-wide text-muted-foreground uppercase">
          Subjects
        </h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={selected.length !== 1}
            onClick={() => setEditing(selected)}
          >
            Edit subject
          </Button>
          <Button
            disabled={selected.length < 2}
            onClick={() => setEditing(selected)}
          >
            Merge subjects{selected.length > 1 ? ` (${selected.length})` : ""}
          </Button>
        </div>
      </header>
      <p className="text-sm text-muted-foreground">
        Select one subject to edit, or several subjects on this page to merge.
        Guides and objectives are kept when subjects are merged.
      </p>
      <SubjectsTable
        subjects={subjects.data}
        filters={filters}
        onFiltersChange={updateFilters}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
      />
      <DashboardPagination
        page={search.page ?? 1}
        total={subjects.total}
        onPageChange={(page) =>
          navigate({ search: (prev) => ({ ...prev, page }) })
        }
      />
      {editing && (
        <ManageSubjectsDialog
          subjects={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setSelectedIds(new Set());
            await router.invalidate();
          }}
        />
      )}
    </div>
  );
}
