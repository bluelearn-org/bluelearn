import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Ban, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";
import { MembersTable, memberColumns } from "@/components/tables/MembersTable";
import { DashboardPagination } from "@/components/tables/DashboardPagination";
import { Button } from "@/components/ui/button";
import {
  fetchMembersTable,
  suspendUser,
  unsuspendUser,
} from "@/lib/api/dashboard";
import {
  dashboardQuery,
  parseDashboardSearch,
  useDashboardSearch,
  usePageSelection,
} from "@/lib/dashboardFilters";

export const Route = createFileRoute("/dashboard/members")({
  validateSearch: parseDashboardSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps, abortController }) =>
    fetchMembersTable(dashboardQuery(memberColumns, deps), {
      signal: abortController.signal,
    }),
  component: RouteComponent,
});

function RouteComponent() {
  const members = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const { filters, updateFilters } = useDashboardSearch(search, (next) =>
    navigate({ search: next, replace: true })
  );
  const [selectedIds, setSelectedIds] = usePageSelection(members);
  const [updatingStatus, setUpdatingStatus] = useState(false); // used for suspending and unsuspending

  const handleSuspend = async () => {
    setUpdatingStatus(true);
    try {
      await Promise.all([...selectedIds].map((id) => suspendUser(id)));
      setSelectedIds(new Set()); // reset selected ids after suspension
      await router.invalidate();
      toast.info("Successfully suspended user(s)!");
    } catch (err) {
      toast.error("Could not suspend one or more users.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleUnsuspend = async () => {
    setUpdatingStatus(true);
    try {
      await Promise.all([...selectedIds].map((id) => unsuspendUser(id)));
      setSelectedIds(new Set()); // reset selected ids after unsuspension
      await router.invalidate();
      toast.info("Successfully unsuspended user(s)!");
    } catch (err) {
      toast.error("Could not unsuspend one or more users.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3 border-b border-border pb-5 sm:gap-6">
        <div className="space-y-1.5">
          <h1 className="font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            Manage Members
          </h1>
        </div>

        <div className="flex gap-2">
          <Button
            className="flex items-center justify-start"
            disabled={selectedIds.size === 0 || updatingStatus}
            onClick={handleUnsuspend}
          >
            <UserRoundCheck />
            Unsuspend
          </Button>

          <Button
            variant="destructive"
            className="flex items-center justify-start"
            disabled={selectedIds.size === 0 || updatingStatus}
            onClick={handleSuspend}
          >
            <Ban />
            Suspend
          </Button>
        </div>
      </header>

      <section className="space-y-3">
        <div className="overflow-x-auto">
          <MembersTable
            MemberData={members.data}
            filters={filters}
            onFiltersChange={updateFilters}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
          />
        </div>
        <DashboardPagination
          page={search.page ?? 1}
          total={members.total}
          onPageChange={(page) =>
            navigate({ search: (prev) => ({ ...prev, page }) })
          }
        />
      </section>
    </div>
  );
}
