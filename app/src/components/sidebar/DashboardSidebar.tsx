import { Link, useRouterState } from "@tanstack/react-router";
import { FileCheckCorner, Shield, Users } from "lucide-react";
import type { LucideProps } from "lucide-react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/authContext";

const items: Array<{
  label: string;
  to: string;
  icon: ForwardRefExoticComponent<
    Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>
  >;
  roles?: Array<string>;
}> = [
  {
    label: "Members",
    to: "/dashboard/members",
    icon: Users,
    roles: ["admin"],
  },
  {
    label: "Roles",
    to: "/dashboard/roles",
    icon: Shield,
    roles: ["admin"],
  },
  {
    label: "Verifier Assignments",
    to: "/dashboard/assignments",
    icon: FileCheckCorner,
    roles: ["lead-verifier", "admin"],
  },
];

export const DashboardSidebar = () => {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  const { roles } = useAuth();

  const isAdmin = roles.includes("admin");
  const isLeadVerifier = roles.includes("lead-verifier");

  const visibleItems = items.filter(
    (item) => !item.roles || item.roles.some((r) => roles.includes(r))
  );

  return (
    <aside className="sticky top-[65px] hidden max-h-[calc(100vh-65px)] w-64 shrink-0 self-start overflow-y-auto px-6 py-6 md:block">
      <div className="mb-6">
        <h2 className="font-mono text-[12px] tracking-[0.08em] text-muted-foreground uppercase">
          {isAdmin ? "Admin " : isLeadVerifier && "Lead Verifier "}Dashboard
        </h2>
      </div>

      <ul>
        {visibleItems.map((item) => {
          const active = pathname === item.to;

          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={cn(
                  "data-label flex items-center gap-4 px-2 py-4 hover:font-bold hover:text-brand-bright-blue",
                  active && "!font-bold !text-brand-bright-blue"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
              <Separator />
            </li>
          );
        })}
      </ul>
    </aside>
  );
};

export const DashboardTabs = () => {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <nav className="-mx-4 mb-6 overflow-x-auto border-b px-4 sm:-mx-8 sm:px-8 md:hidden">
      <ul className="flex w-max items-center gap-6">
        {items.map((item) => {
          const active = pathname === item.to;

          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={cn(
                  "data-label flex shrink-0 items-center gap-2 border-b-2 border-transparent py-3 whitespace-nowrap",
                  active && "border-primary font-bold text-primary"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
