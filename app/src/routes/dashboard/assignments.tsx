import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { UserRoundArrowLeft } from "@/components/icons/UserRoundArrowLeft";
import { Button } from "@/components/ui/button";
import { AssignmentsTable } from "@/components/tables/AssignmentsTable";
import {
  fetchAssignmentsTable,
  reassignPanelMember,
} from "@/lib/api/dashboard";

export const Route = createFileRoute("/dashboard/assignments")({
  loader: async ({ abortController }) => {
    const data = await fetchAssignmentsTable({
      signal: abortController.signal,
    });
    return { data };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const assignments = Route.useLoaderData();
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isReassigning, setIsReassigning] = useState(false);

  const handleReassign = async () => {
    setIsReassigning(true);
    try {
      await Promise.all(
        [...selectedIds]
          .map((id) => ({
            id,
            panelId: assignments.data.find((a) => a.id === id)?.panel_id,
          }))
          .filter(
            (t): t is { id: string; panelId: string } => t.panelId != null
          )
          .map(({ id, panelId }) => reassignPanelMember(id, panelId))
      );
      setSelectedIds(new Set());
      await router.invalidate();
      toast.info("Successfully reassigned user(s)!");
    } catch (err) {
      toast.error("Could not reassign one or more user(s).");
    } finally {
      setIsReassigning(false);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3 border-b border-border pb-5 sm:gap-6">
        <div className="space-y-1.5">
          <h1 className="font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            Manage Guide Assignments
          </h1>
        </div>

        <div className="flex gap-2">
          <Button
            variant="default"
            className="flex items-center justify-start"
            disabled={selectedIds.size === 0 || isReassigning}
            onClick={handleReassign}
          >
            <UserRoundArrowLeft />
            Reassign
          </Button>
        </div>
      </header>

      <section className="space-y-3">
        <div className="overflow-x-auto">
          {/* AssignmentsTable */}
          <AssignmentsTable
            assignmentsData={assignments.data}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
          />
        </div>
      </section>
    </div>
  );
}
