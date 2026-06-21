import { Outlet, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/subjects")({
  component: SubjectsLayout,
})

function SubjectsLayout() {
  return <Outlet />
}