import { Link } from "@tanstack/react-router";
import { ArrowLeft, PanelLeftClose } from "lucide-react";
import type { Objective, Walkthrough } from "@bluelearn/schemas";
import type { BreadcrumbOrigin } from "@/lib/breadcrumbs";
import type { ObjectiveGuideSearch } from "@/lib/objectiveSnapshot";
import { Badge } from "@/components/ui/badge";

type GuideContext = {
  targetSlug: string;
  targetTitle: string;
  // The objective the reader was opened from, handed back on return so it
  // keeps its place in the sequence.
  objectiveSearch?: ObjectiveGuideSearch;
};

// The objective page already sits around this panel, so it offers no way back.
// A request has no guide to open, and a preview must not navigate away from
// its unsaved draft.
type ObjectiveContext = {
  objective: Pick<Objective, "slug" | "title">;
  guideSlug: string | null;
  isRequest: boolean;
  preview: boolean;
  // The objective page opens the panel from a node click and offers a way to
  // fold it back into the rail.
  onClose?: () => void;
};

type WalkthroughPanelProps = {
  node: Walkthrough["nodes"][number];
  breadcrumbOrigin?: BreadcrumbOrigin;
} & (GuideContext | ObjectiveContext);

export function WalkthroughPanel(props: WalkthroughPanelProps) {
  const { node, breadcrumbOrigin } = props;
  const isRequest = "objective" in props && props.isRequest;
  const onClose = "objective" in props ? props.onClose : undefined;

  let back: { label: string; path: string } | null;
  let openSlug: string | null;
  let openOrigin: BreadcrumbOrigin | undefined;
  let backSearch: ObjectiveGuideSearch = {};
  let openSearch: ObjectiveGuideSearch = {};

  if ("objective" in props) {
    const title = props.objective.title ?? "Untitled objective";

    back = null;
    openSlug = props.preview ? null : props.guideSlug;
    openSearch = { objective: props.objective.slug };
    openOrigin = {
      type: "objective",
      title,
      path: `/objectives/${props.objective.slug}`,
    };
  } else {
    const { targetSlug, targetTitle, objectiveSearch = {} } = props;

    back = { label: targetTitle, path: `/guides/${targetSlug}` };
    backSearch = objectiveSearch;
    openSlug = node.slug;
    // Opening the target keeps the trail the user arrived by; opening a
    // prerequisite makes the target the origin, since that is what led here.
    openOrigin =
      node.slug === targetSlug
        ? breadcrumbOrigin
        : { type: "guide", title: targetTitle, path: back.path };
    openSearch = node.slug === targetSlug ? objectiveSearch : {};
  }

  return (
    <aside className="relative flex flex-col gap-6 overflow-y-auto px-6 py-6 md:h-full">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          title="Close panel"
          className="absolute top-4 right-4 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      )}
      {back && (
        <Link
          to={back.path}
          search={backSearch}
          state={{ breadcrumbOrigin }}
          className="mono-micro flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Back to {back.label}</span>
        </Link>
      )}

      <div className="space-y-3">
        {isRequest && (
          <p className="mono-micro text-muted-foreground">Guide request</p>
        )}
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
          <h3 className="text-sm font-semibold">
            {isRequest ? "About this request" : "About this guide"}
          </h3>
          <p className="text-sm text-muted-foreground">{node.summary}</p>
        </div>
      )}

      {openSlug && (
        <Link
          to="/guides/$slug"
          params={{ slug: openSlug }}
          search={openSearch}
          state={{ breadcrumbOrigin: openOrigin }}
          className="btn-pri w-full"
        >
          Open Guide
        </Link>
      )}
    </aside>
  );
}
