import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/roles")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="space-y-5">
      <header className="space-y-1.5 border-b border-border pb-5">
        <h1 className="font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
          Manage Roles
        </h1>
      </header>

      <section className="space-y-3"></section>
    </div>
  );
}
