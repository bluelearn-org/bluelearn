import { useMemo } from "react";
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
  House,
  Pencil,
  Plus,
} from "lucide-react";

import type { GuideReference, HydratedGuide } from "@/types/guides";

import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { CollapsibleSection } from "@/components/CollapsibleSection";

import { buildBreadcrumbs } from "@/lib/breadcrumbs";
import { extractHeadings } from "@/lib/guideUtils";
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

export const Route = createFileRoute("/guides/$slug")({
  component: RouteComponent,
});

function RouteComponent() {
  const { slug } = Route.useParams();

  const breadcrumbOrigin = useLocation({
    select: (location) => location.state.breadcrumbOrigin,
  });

  const guide = getGuideBySlug(guides, slug);

  if (!guide) {
    throw notFound();
  }

  const hydratedGuide: HydratedGuide = hydrateGuide(guide, guides, subjects);

  const breadcrumbs = buildBreadcrumbs(hydratedGuide.title, breadcrumbOrigin);

  const headings = useMemo(
    () => extractHeadings(guide.content),
    [guide.content]
  );

  const guideMenuItems = [
    { label: "Edit Guide", to: "/edit", icon: <Pencil className="h-4 w-4" /> },
    {
      label: "Create Variant",
      to: "/contribute",
      icon: <Plus className="h-4 w-4" />,
    },
    // { label: "Report", to: "/report", <Flag className="h-4 w-4" /> },// TODO: Implement post v1
  ];

  return (
    <div className="mx-auto h-[calc(100vh-70px)] max-w-[1280px] border-x bg-background">
      <section className="grid grid-cols-[320px_1fr] border-b">
        <Sidebar>
          {/* Prerequisites */}
          <CollapsibleSection
            title={<p className="ml-auto">Prerequisites</p>}
            defaultOpen={true}
          >
            <ul className="space-y-2">
              {hydratedGuide.prerequisites.map((prereq: GuideReference) => (
                <li
                  key={prereq.slug}
                  className="text-sm text-muted-foreground hover:text-foreground"
                  style={{
                    paddingLeft: 6,
                  }}
                >
                  <Link
                    to="/guides/$slug"
                    params={{ slug: prereq.slug }}
                    state={{
                      breadcrumbOrigin: {
                        type: "guide",
                        title: hydratedGuide.title,
                        path: `/guides/${slug}`,
                      },
                    }}
                  >
                    {prereq.title}
                  </Link>
                </li>
              ))}
            </ul>
          </CollapsibleSection>

          {/* TOC */}
          <CollapsibleSection
            title={<p className="ml-auto">Table of Contents</p>}
            defaultOpen={true}
          >
            <ul className="space-y-2">
              {headings.map((h, idx) => (
                <li
                  key={idx}
                  className="cursor-pointer text-sm text-muted-foreground hover:text-foreground"
                  style={{
                    paddingLeft:
                      h.level === 1
                        ? 6
                        : h.level === 2
                          ? 12
                          : h.level === 3
                            ? 24
                            : 28,
                  }}
                >
                  {h.text}
                </li>
              ))}
            </ul>
          </CollapsibleSection>

          {/* Variants */}
          <CollapsibleSection
            title={<p className="ml-auto">Variants</p>}
            defaultOpen={true}
          >
            <ul className="space-y-2"></ul>
          </CollapsibleSection>
        </Sidebar>

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
              <Button variant="outline" className="btn-sec">
                View Walkthrough
              </Button>

              <Button variant="ghost" size="icon">
                <ArrowBigUp
                  className="h-4 w-4"
                  color="#3D80DD"
                  fill="#3D80DD"
                />
              </Button>

              <Button variant="ghost" size="icon">
                <ArrowBigDown className="h-4 w-4" />
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
