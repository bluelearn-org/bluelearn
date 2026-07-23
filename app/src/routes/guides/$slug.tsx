import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/guides/$slug")({
  component: RouteComponent,
});

function RouteComponent() {
  return <Outlet />;
}
