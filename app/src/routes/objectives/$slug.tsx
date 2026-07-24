import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/objectives/$slug")({
  component: RouteComponent,
});

function RouteComponent() {
  return <Outlet />;
}
