import { Outlet, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/paths")({
  component: RouteComponent,
})

function RouteComponent() {
  return <Outlet />
}
