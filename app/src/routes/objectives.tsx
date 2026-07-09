import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/objectives")({
  component: RouteComponent,
});

function RouteComponent() {
  return <Outlet />;
}
