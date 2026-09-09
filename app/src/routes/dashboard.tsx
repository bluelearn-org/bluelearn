import { Outlet, createFileRoute } from "@tanstack/react-router";
import {
  DashboardSidebar,
  DashboardTabs,
} from "@/components/sidebar/DashboardSidebar";
import { requireSession } from "@/lib/auth";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  beforeLoad: requireSession,
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="mx-auto max-w-[1280px] bg-background">
      <div className="flex min-h-[calc(100svh_-_65px)]">
        {/* Left Sidebar Navigation */}
        <DashboardSidebar />

        {/* Right Content Area */}
        <div className="min-w-0 flex-1 px-4 py-8 sm:px-8 md:border-l lg:px-16">
          <DashboardTabs />
          <Outlet />
        </div>
      </div>
    </div>
  );
}
