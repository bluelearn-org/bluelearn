import { Link, createFileRoute } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { Route as ReviewSlugRoute } from "@/routes/review.$slug";

import { getReviewQueue } from "@/lib/api/reviews";

export const Route = createFileRoute("/review/")({
  loader: async ({ abortController }) => {
    try {
      return await getReviewQueue({ signal: abortController.signal });
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

type QueueCase = {
  id: string;
  title: string | null;
  created_at: string;
  decision: "approved" | "rejected" | null;
};

// Not voted yet = still needs the reviewer's attention. Once voted, echo the
// standing vote and flag that it can still be changed until the panel closes.
function reviewerStatus(decision: QueueCase["decision"]) {
  return decision ? `${decision} • editable` : "needs review";
}

function CaseGrid({ cases }: { cases: Array<QueueCase> }) {
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
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
                Review Case
              </p>
              <Badge
                variant="outline"
                className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
              >
                {reviewerStatus(c.decision)}
              </Badge>
            </div>

            <h3 className="mt-2 text-xl font-semibold tracking-tight">
              {c.title ?? "Untitled Guide"}
            </h3>

            <p className="mt-2 font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
              {new Date(c.created_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
