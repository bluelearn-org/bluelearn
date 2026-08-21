import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/assignments")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/dashboard/assignments"!</div>;
}
