import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/review")({
  component: RouteComponent,
});

function RouteComponent() {
  return <Outlet />;
}
