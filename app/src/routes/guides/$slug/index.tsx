import { useState } from "react";
import {
  Link,
  createFileRoute,
  notFound,
  useLocation,
} from "@tanstack/react-router";
import {
  ArrowBigDown,
  ArrowBigUp,
  Ellipsis,
  History,
  House,
  Pencil,
  Plus,
  Replace,
  Target,
  Users,
} from "lucide-react";

import type { HydratedGuide } from "@/types/guides";

import type { Action } from "@/components/Sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

import { buildBreadcrumbs } from "@/lib/breadcrumbs";
import { getGuideBySlug, hydrateGuide } from "@/lib/getData";

import guides from "@/data/guides.json";
import subjects from "@/data/subjects.json";

import "katex/dist/katex.min.css";
import { Sidebar } from "@/components/Sidebar";
import { GuideReader } from "@/components/GuideReader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Route as GuideWalkthroughRoute } from "@/routes/guides/$slug/walkthrough";

const SIDEBAR_ACTIONS: Array<Action> = [
  { icon: Replace, label: "View Variants" },
  { icon: Target, label: "View Objectives" },
  { icon: Users, label: "View Contributors" },
  { icon: History, label: "View Revisions" },
];

function useVote() {
  const [vote, setVote] = useState<"up" | "down" | null>(null);

  const toggleVote = (type: "up" | "down") => {
    setVote((current) => (current === type ? null : type));
  };

  return {
    vote,
    upvote: () => toggleVote("up"),
    downvote: () => toggleVote("down"),
  };
}

export const Route = createFileRoute("/guides/$slug/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { slug } = Route.useParams();

  const { vote, upvote, downvote } = useVote();

  const breadcrumbOrigin = useLocation({
    select: (location) => location.state.breadcrumbOrigin,
  });

  const guide = getGuideBySlug(guides, slug);

  if (!guide) {
    throw notFound();
  }

  const guideMenuItems = [
    {
      label: "Edit Guide",
      to: `/edit/${slug}`,
      icon: <Pencil className="h-4 w-4" />,
    },
    {
      label: "Create Variant",
      to: "/contribute",
      icon: <Plus className="h-4 w-4" />,
    },
    // { label: "Report", to: "/report", <Flag className="h-4 w-4" /> },// TODO: Implement post v1
  ];

  const hydratedGuide: HydratedGuide = hydrateGuide(guide, guides, subjects);

  const breadcrumbs = buildBreadcrumbs(hydratedGuide.title, breadcrumbOrigin);

  return (
    <div className="mx-auto h-[calc(100vh-70px)] max-w-[1280px] border-x bg-background">
      <section className="grid grid-cols-[320px_1fr] border-b">
        <Sidebar
          sidebarActions={
            <div className="flex items-center justify-start gap-4">
              {SIDEBAR_ACTIONS.map((action: Action) => (
                <Tooltip key={action.label}>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="lg">
                      <action.icon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>

                  <TooltipContent>
                    <p>{action.label}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          }
          guide={hydratedGuide}
          slug={slug}
        />

        {/* MAIN */}
        <main className="h-[calc(100vh-70px)] min-w-0 overflow-y-auto px-10 py-4 lg:px-16">
          {/* Breadcrumbs */}
          <div className="mb-6 flex items-center justify-between gap-4">
            <ul className="flex min-w-0 flex-nowrap items-center gap-2 text-xs tracking-[0.08em] text-muted-foreground uppercase">
              {breadcrumbs.map((crumb, idx) => (
                <li
                  key={`${crumb.label}-${idx}`}
                  className="mono-micro flex min-w-0 items-center gap-2"
                >
                  {crumb.path ? (
                    <Link
                      to={crumb.path}
                      className="flex min-w-0 items-center hover:text-foreground"
                      aria-label={crumb.label}
                    >
                      {idx === 0 ? (
                        <House className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <span className="max-w-[30ch] truncate">
                          {crumb.label}
                        </span>
                      )}
                    </Link>
                  ) : (
                    <span className="max-w-[30ch] truncate">{crumb.label}</span>
                  )}
                  {idx < breadcrumbs.length - 1 && (
                    <span className="shrink-0">/</span>
                  )}
                </li>
              ))}
            </ul>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-2">
              <Link
                to={GuideWalkthroughRoute.to}
                params={{ slug: slug }}
                // state={{
                //   breadcrumbOrigin: {
                //     type: "objective",
                //     title: objective.title,
                //     path: `/objectives/${slug}`,
                //   },
                // }}
                className="btn-outline"
              >
                View Walkthrough
              </Link>

              <Button variant="outline" size="lg" onClick={() => upvote()}>
                <ArrowBigUp
                  className="h-4 w-4"
                  color={vote == "up" ? "#3D80DD" : "#000000"}
                  fill={vote == "up" ? "#3D80DD" : "#FFFFFF"}
                />
              </Button>

              <Button variant="outline" size="lg" onClick={() => downvote()}>
                <ArrowBigDown
                  className="h-4 w-4"
                  color={vote == "down" ? "#3D80DD" : "#000000"}
                  fill={vote == "down" ? "#3D80DD" : "#FFFFFF"}
                />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-md"
                  >
                    <Ellipsis className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-48 font-mono">
                  {guideMenuItems.map((item) => (
                    <DropdownMenuItem key={item.to} asChild>
                      <Link to={item.to} className="text-xs">
                        {item.icon}
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <Separator className="mb-8" />

          {/* Header */}

          <GuideReader guide={hydratedGuide} />
        </main>
      </section>
    </div>
  );
}
