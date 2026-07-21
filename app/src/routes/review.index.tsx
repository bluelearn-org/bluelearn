import { Link, createFileRoute } from "@tanstack/react-router";

import { Separator } from "@/components/ui/separator";

import { Route as ReviewSlugRoute } from "@/routes/review.$slug";

import { listReviewCases } from "@/lib/api/reviews";

export const Route = createFileRoute("/review/")({
  loader: async ({ abortController }) => {
    try {
      return await listReviewCases({ signal: abortController.signal });
    } catch {
      return [];
    }
  },
  component: RouteComponent,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1280px] border-x bg-background">
      <section className="border-b px-8 py-8 lg:px-16">
        <div className="mb-6">
          <h1 className="data-label text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            Review Queue
          </h1>
        </div>

        <Separator className="mb-4 bg-border" />

        {children}
      </section>
    </div>
  );
}

function RouteComponent() {
  const cases = Route.useLoaderData();

  if (cases.length === 0) {
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">No review cases yet.</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <CaseGrid cases={cases} />
    </Shell>
  );
}

function CaseGrid({
  cases,
}: {
  cases: Array<{
    id: string;
    title: string | null;
    status: string;
    created_at: string;
  }>;
}) {
  if (cases.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing to review here yet.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {cases.map((c) => (
        <Link
          key={c.id}
          to={ReviewSlugRoute.to}
          params={{ slug: c.id }}
          className="block"
        >
          <div className="rounded-md border bg-background p-4 shadow-none transition-colors hover:bg-muted">
            <h3 className="text-xl font-semibold tracking-tight">
              {c.title ?? "Untitled Guide"}
            </h3>

            <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
              <span className="font-mono text-[11px] tracking-[0.08em] uppercase">
                {c.status}
              </span>

              <span className="font-mono text-[11px] tracking-[0.08em] uppercase">
                {new Date(c.created_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
