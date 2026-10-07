import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import type { RoleApplicationDecision } from "@/lib/api/dashboard";
import {
  RoleApplicationsTable,
  roleApplicationColumns,
} from "@/components/tables/RoleApplicationsTable";
import { DashboardPagination } from "@/components/tables/DashboardPagination";
import { Button } from "@/components/ui/button";
import {
  decideRoleApplication,
  fetchRoleApplicationsTable,
} from "@/lib/api/dashboard";
import {
  dashboardQuery,
  parseDashboardSearch,
  useDashboardSearch,
  usePageSelection,
} from "@/lib/dashboardFilters";

export const Route = createFileRoute("/dashboard/applications")({
  validateSearch: parseDashboardSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps, abortController }) =>
    fetchRoleApplicationsTable(dashboardQuery(roleApplicationColumns, deps), {
      signal: abortController.signal,
    }),
  component: RouteComponent,
});

function RouteComponent() {
  const applications = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const { filters, updateFilters } = useDashboardSearch(search, (next) =>
    navigate({ search: next, replace: true })
  );
  const [selectedIds, setSelectedIds] = usePageSelection(applications);
  const [deciding, setDeciding] = useState(false);

  const decide = async (status: RoleApplicationDecision) => {
    setDeciding(true);
    try {
      await Promise.all(
        [...selectedIds].map((id) => decideRoleApplication(id, status))
      );
      setSelectedIds(new Set());
      await router.invalidate();
      toast.info(
        status === "approved"
          ? "Approved the selected application(s); the role is granted."
          : "Rejected the selected application(s)."
      );
    } catch (err) {
      toast.error("Could not decide one or more applications.");
    } finally {
      setDeciding(false);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3 border-b border-border pb-5 sm:gap-6">
        <div className="space-y-1.5">
          <h1 className="font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            Role Applications
          </h1>
        </div>

        <div className="flex gap-2">
          <Button
            variant="default"
            className="flex items-center justify-start"
            disabled={selectedIds.size === 0 || deciding}
            onClick={() => decide("approved")}
          >
            <Check />
            Approve
          </Button>

          <Button
            variant="destructive"
            className="flex items-center justify-start"
            disabled={selectedIds.size === 0 || deciding}
            onClick={() => decide("rejected")}
          >
            <X />
            Reject
          </Button>
        </div>
      </header>

      <section className="space-y-3">
        <div className="overflow-x-auto">
          <RoleApplicationsTable
            applications={applications.data}
            filters={filters}
            onFiltersChange={updateFilters}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
          />
        </div>
        <DashboardPagination
          page={search.page ?? 1}
          total={applications.total}
          onPageChange={(page) =>
            navigate({ search: (prev) => ({ ...prev, page }) })
          }
        />
      </section>
    </div>
  );
}
