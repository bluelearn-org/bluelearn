import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Ban, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";
import { MembersTable } from "@/components/tables/MembersTable";
import { Button } from "@/components/ui/button";
import {
  fetchMembersTable,
  suspendUser,
  unsuspendUser,
} from "@/lib/api/dashboard";

export const Route = createFileRoute("/dashboard/members")({
  loader: async ({ abortController }) => {
    const data = await fetchMembersTable({ signal: abortController.signal });
    return { data };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const members = Route.useLoaderData();
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [suspending, setSuspending] = useState(false); // used also for unsuspending

  const handleSuspend = async () => {
    setSuspending(true);
    try {
      await Promise.all([...selectedIds].map((id) => suspendUser(id)));
      setSelectedIds(new Set()); // reset selected ids after suspension
      await router.invalidate();
      toast.info("Successfully suspended user(s)!");
    } catch (err) {
      toast.error("Could not suspend one or more users.");
    } finally {
      setSuspending(false);
    }
  };

  const handleUnsuspend = async () => {
    setSuspending(true);
    try {
      await Promise.all([...selectedIds].map((id) => unsuspendUser(id)));
      setSelectedIds(new Set()); // reset selected ids after suspension
      await router.invalidate();
      toast.info("Successfully unsuspended user(s)!");
    } catch (err) {
      toast.error("Could not unsuspend one or more users.");
    } finally {
      setSuspending(false);
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
            disabled={selectedIds.size === 0 || suspending}
            onClick={handleUnsuspend}
          >
            <UserRoundCheck />
            Unsuspend
          </Button>

          <Button
            variant="destructive"
            className="flex items-center justify-start"
            disabled={selectedIds.size === 0 || suspending}
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
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
          />
        </div>
      </section>
    </div>
  );
}
