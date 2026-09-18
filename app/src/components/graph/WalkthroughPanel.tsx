import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { Objective, Walkthrough } from "@bluelearn/schemas";
import type { BreadcrumbOrigin } from "@/lib/breadcrumbs";
import { Badge } from "@/components/ui/badge";

type WalkthroughPanelProps = {
  node: Walkthrough["nodes"][number];
  targetSlug: string;
  targetTitle: string;
  breadcrumbOrigin?: BreadcrumbOrigin;
  objective?: Pick<Objective, "slug" | "title">;
  canOpenGuide?: boolean;
};

export function WalkthroughPanel({
  node,
  targetSlug,
  targetTitle,
  breadcrumbOrigin,
  objective,
  canOpenGuide = true,
}: WalkthroughPanelProps) {
  const back = objective
    ? {
        label: objective.title ?? "Untitled objective",
        path: `/objectives/${objective.slug}`,
      }
    : { label: targetTitle, path: `/guides/${targetSlug}` };

  // Opening the target keeps the trail the user arrived by; opening a
  // prerequisite makes the target the origin, since that is what led here.
  const openOrigin: BreadcrumbOrigin | undefined = objective
    ? { type: "objective", title: back.label, path: back.path }
    : node.slug === targetSlug
      ? breadcrumbOrigin
      : { type: "guide", title: targetTitle, path: `/guides/${targetSlug}` };

  return (
    <aside className="flex flex-col gap-6 overflow-y-auto border-t px-6 py-6 md:h-full md:border-t-0 md:border-r">
      <Link
        to={back.path}
        state={{ breadcrumbOrigin }}
        className="mono-micro flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">Back to {back.label}</span>
      </Link>

      <div className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight">{node.title}</h2>

        {node.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {node.tags.map((tag) => (
              <Badge
                key={tag.slug}
                variant="outline"
                className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="-mx-6 grid grid-cols-2 border-y">
        <div className="border-r px-6 py-3">
          <p className="mono-micro text-muted-foreground">Level</p>
          <p className="text-lg font-semibold">{node.level}</p>
        </div>
        <div className="px-6 py-3">
          <p className="mono-micro text-muted-foreground">Duration</p>
          <p className="text-lg font-semibold">
            {node.duration_minutes > 0 ? `${node.duration_minutes} min` : "--"}
          </p>
        </div>
      </div>

      {node.summary && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">About this guide</h3>
          <p className="text-sm text-muted-foreground">{node.summary}</p>
        </div>
      )}

      {canOpenGuide && (
        <Link
          to="/guides/$slug"
          params={{ slug: node.slug }}
          state={{ breadcrumbOrigin: openOrigin }}
          className="btn-pri w-full"
        >
          Open Guide
        </Link>
      )}
    </aside>
  );
}
