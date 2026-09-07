import { Link, createFileRoute, useLocation } from "@tanstack/react-router";
import { Ellipsis, House, Pencil } from "lucide-react";

import type { Breadcrumb } from "@/lib/breadcrumbs";
import { buildBreadcrumbs } from "@/lib/breadcrumbs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";

import { buildObjectiveFlow } from "@/lib/objectiveSnapshot";
import { getObjective } from "@/lib/api/objectives";
import { getMyIdentity } from "@/lib/api/identity";
import { listGuides } from "@/lib/api/guides";

import ObjectiveFlow from "@/components/objective/ObjectiveFlow";
import { ObjectiveActions } from "@/components/objective/ObjectiveActions";
import { ObjectiveHeader } from "@/components/objective/ObjectiveHeader";

export const Route = createFileRoute("/objectives/$slug/")({
  loader: async ({ params: { slug }, abortController }) => {
    const [objective, guides, identity] = await Promise.all([
      getObjective(slug, { signal: abortController.signal }),
      listGuides({ signal: abortController.signal }),
      getMyIdentity({ signal: abortController.signal }).catch(() => null),
    ]);
    return { ...objective, guides, identity };
  },
  pendingComponent: ObjectivePending,
  errorComponent: ObjectiveError,
  component: PathPage,
});

function Shell({
  header,
  children,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1280px] bg-background">
      <section className="border-b px-8 py-8 lg:px-16">
        {header}

        <Separator className="mb-4 bg-border" />

        {children}
      </section>
    </div>
  );
}

function Breadcrumbs({ crumbs }: { crumbs: Array<Breadcrumb> }) {
  return (
    <ul className="mono-micro flex min-w-0 flex-nowrap items-center gap-2 text-xs tracking-[0.08em] text-muted-foreground uppercase">
      {crumbs.map((crumb, idx) => (
        <li
          key={`${crumb.label}-${idx}`}
          className="flex min-w-0 items-center gap-2"
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
                <span className="max-w-[30ch] truncate">{crumb.label}</span>
              )}
            </Link>
          ) : (
            <span className="max-w-[30ch] truncate">{crumb.label}</span>
          )}
          {idx < crumbs.length - 1 && <span className="shrink-0">/</span>}
        </li>
      ))}
    </ul>
  );
}

function FallbackHeading() {
  return (
    <h1 className="mb-4 font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
      Objective
    </h1>
  );
}

function ObjectivePending() {
  return (
    <Shell header={<FallbackHeading />}>
      <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />
    </Shell>
  );
}

function ObjectiveError({ error }: { error: Error }) {
  return (
    <Shell header={<FallbackHeading />}>
      <p className="text-sm text-muted-foreground">
        {error.message || "Objective could not be loaded. Try again shortly."}
      </p>
    </Shell>
  );
}

function ObjectiveMenu({
  slug,
  sourceRevisionId,
}: {
  slug: string;
  sourceRevisionId: string;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-md">
          <Ellipsis className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48 font-mono">
        <DropdownMenuItem asChild>
          <Link
            to="/contribute"
            search={{ source: sourceRevisionId, edit: slug }}
            className="cursor-pointer text-xs"
          >
            <Pencil className="h-4 w-4" />
            Edit Objective
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PathPage() {
  const { slug } = Route.useParams();
  const { objective, snapshot, guides, identity } = Route.useLoaderData();
  const isCurator = identity?.roles.includes("curator") ?? false;

  const breadcrumbOrigin = useLocation({
    select: (location) => location.state.breadcrumbOrigin,
  });
  const breadcrumbs = buildBreadcrumbs(
    objective.title ?? "Untitled objective",
    breadcrumbOrigin
  );

  const { targets } = buildObjectiveFlow(snapshot, guides);

  return (
    <Shell
      header={
        <>
          <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <Breadcrumbs crumbs={breadcrumbs} />

            <div className="flex shrink-0 items-center gap-2">
              <ObjectiveActions slug={slug} />

              {isCurator && objective.current_revision_id ? (
                <ObjectiveMenu
                  slug={slug}
                  sourceRevisionId={objective.current_revision_id}
                />
              ) : null}
            </div>
          </div>

          <ObjectiveHeader
            objective={objective}
            stats={{
              guides: objective.guides_total,
              durationMinutes: objective.duration_minutes,
            }}
          />
        </>
      }
    >
      {targets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          This objective has no sub-objectives yet.
        </p>
      ) : (
        <ObjectiveFlow objective={objective} targets={targets} />
      )}
    </Shell>
  );
}
