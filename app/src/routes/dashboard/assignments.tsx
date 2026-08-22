import { createFileRoute } from "@tanstack/react-router";
import { UserRoundArrowLeft } from "@/components/icons/UserRoundArrowLeft";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard/assignments")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3 border-b border-border pb-5 sm:gap-6">
        <div className="space-y-1.5">
          <h1 className="font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            Manage Guide Assignments
          </h1>
        </div>

        <div className="flex gap-2">
          <Button variant="default" className="flex items-center justify-start">
            <UserRoundArrowLeft />
            Reassign
          </Button>
        </div>
      </header>

      <section className="space-y-3">
        <div className="hidden overflow-x-auto md:block">
          {/* AssignmentsTable */}
        </div>
      </section>
    </div>
  );
}
