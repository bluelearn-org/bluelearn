import { createFileRoute } from "@tanstack/react-router";
import { ShieldMinus, ShieldPlus, SquareArrowRightExit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RolesTable } from "@/components/tables/RolesTable";

export const Route = createFileRoute("/dashboard/roles")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3 border-b border-border pb-5 sm:gap-6">
        <div className="space-y-1.5">
          <h1 className="font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            Manage Roles
          </h1>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex items-center justify-start">
            <SquareArrowRightExit />
            Mark AFK
          </Button>

          <Button variant="default" className="flex items-center justify-start">
            <ShieldPlus />
            Add Role
          </Button>

          <Button
            variant="destructive"
            className="flex items-center justify-start"
          >
            <ShieldMinus />
            Remove Role
          </Button>
        </div>
      </header>

      <section className="space-y-3">
        <div className="hidden overflow-x-auto md:block">
          <RolesTable />
        </div>
      </section>
    </div>
  );
}
