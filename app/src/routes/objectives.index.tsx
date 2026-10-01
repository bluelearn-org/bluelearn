import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { paginationSchema } from "@bluelearn/schemas";

import { Separator } from "@/components/ui/separator";
import { ObjectiveCard } from "@/components/cards/ObjectiveCard";
import { Pagination } from "@/components/Pagination";

import { Route as ObjectiveRoute } from "@/routes/objectives/$slug/index";

import { listObjectives } from "@/lib/api/objectives";
import { formatDate, formatDuration } from "@/lib/guideUtils";
import { buildPageMeta } from "@/lib/seo";

const PAGE_SIZE = 20;

export const Route = createFileRoute("/objectives/")({
  head: () => ({
    meta: buildPageMeta(
      "Learning Objectives",
      "Explore learning objectives and follow step-by-step guides to build your knowledge from the ground up."
    ),
  }),
  validateSearch: paginationSchema.pick({ page: true }),
  loaderDeps: ({ search: { page } }) => ({ page }),
  loader: ({ deps: { page }, abortController }) =>
    listObjectives(
      { page, limit: PAGE_SIZE },
      { signal: abortController.signal }
    ),
  pendingComponent: ObjectivesPending,
  errorComponent: ObjectivesError,
  component: ObjectivesIndex,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1280px] bg-background">
      <section className="border-b px-8 py-8 lg:px-16">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            Objectives
          </h1>
        </div>

        <Separator className="mb-4 bg-border" />

        {children}
      </section>
    </div>
  );
}

function ObjectivesPending() {
  return (
    <Shell>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-lg border border-border bg-card"
          />
        ))}
      </div>
    </Shell>
  );
}

function ObjectivesError({ error }: { error: Error }) {
  return (
    <Shell>
      <p className="text-sm text-muted-foreground">
        {error.message || "Objectives could not be loaded. Try again shortly."}
      </p>
    </Shell>
  );
}

function ObjectivesIndex() {
  const { objectives, total } = Route.useLoaderData();
  const { page } = Route.useSearch();
  const navigate = useNavigate();

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const goToPage = (p: number) =>
    navigate({ to: "/objectives", search: { page: p } });

  // The published filter guarantees a slug, so this only narrows the type.
  const cards = objectives
    .filter((o): o is typeof o & { slug: string } => o.slug !== null)
    .map((o) => ({
      slug: o.slug,
      title: o.title,
      summary: o.summary,
      curator: o.curator,
      created_at: formatDate(new Date(o.created_at)),
      featuredSubObjective: o.featured_sub_objective,
      stats: [
        { label: "Duration", data: formatDuration(o.duration_minutes) },
        { label: "Guides", data: o.guides_total },
      ] as Array<{ label: string; data: string | number }>,
    }));

  if (total === 0) {
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">No objectives yet.</p>
      </Shell>
    );
  }

  // A hand-typed or stale page number lands past the end. Say so instead of
  // showing the empty-state copy, which reads like there is nothing to browse.
  if (page > totalPages) {
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">
          Page {page} is past the last page.{" "}
          <Link
            to="/objectives"
            search={{ page: 1 }}
            className="underline underline-offset-4"
          >
            Back to page 1
          </Link>
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {cards.map((objective) => (
          <ObjectiveCard
            key={objective.slug}
            objective={objective}
            to={ObjectiveRoute.to}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-8 mb-4">
          <Pagination
            activePageNo={page}
            onPageSelect={goToPage}
            toFirst={() => goToPage(1)}
            onPrevious={() => goToPage(Math.max(1, page - 1))}
            onNext={() => goToPage(Math.min(totalPages, page + 1))}
            toLast={() => goToPage(totalPages)}
            totalPages={totalPages}
          />
        </div>
      )}
    </Shell>
  );
}
