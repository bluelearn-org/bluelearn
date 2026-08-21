import { useEffect, useRef, useState } from "react";
import { Link, createFileRoute, useRouter } from "@tanstack/react-router";

import type { QueueCase } from "@/lib/api/reviews";
import { NotFound } from "@/components/NotFound";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useRequireRole } from "@/lib/authContext";
import { deadlineTickMs, formatTimeRemaining } from "@/lib/reviewDeadline";

import { Route as ReviewCaseIdRoute } from "@/routes/review.$caseId";
import { getReviewQueue } from "@/lib/api/reviews";

export const Route = createFileRoute("/review/")({
  loader: async ({ abortController }) => {
    try {
      return await getReviewQueue({ signal: abortController.signal });
    } catch (err) {
      if (abortController.signal.aborted) throw err;
      return [];
    }
  },
  component: RouteComponent,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1280px] bg-background">
      <section className="border-b px-8 py-8 lg:px-16">
        <div className="mb-6">
          <h1 className="font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
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
  const access = useRequireRole(["verifier", "admin"]);

  if (access === "pending") return null;
  if (access === "not-found") return <NotFound />;

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

interface CaseTimerProps {
  expiresAt: string | null;
  decision: QueueCase["decision"];
}

function CaseTimer({ expiresAt, decision }: CaseTimerProps) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const invalidated = useRef(false);

  const expiresMs = expiresAt ? new Date(expiresAt).getTime() : null;

  useEffect(() => {
    if (decision || expiresMs === null) return;

    const diffMs = expiresMs - Date.now();
    if (diffMs <= 0) {
      if (invalidated.current) return;
      invalidated.current = true;
      router.invalidate();
      return;
    }

    const timer = setTimeout(() => setNow(Date.now()), deadlineTickMs(diffMs));
    return () => clearTimeout(timer);
  }, [decision, expiresMs, now, router]);

  if (decision || expiresMs === null) return null;

  const diffMs = expiresMs - now;

  if (diffMs <= 0) {
    return <span className="font-mono text-xs text-destructive">Expired</span>;
  }

  return (
    <span className="font-mono text-xs text-muted-foreground">
      {formatTimeRemaining(diffMs)}
    </span>
  );
}

// Not voted yet = still needs the reviewer's attention. Once voted, echo the
// standing vote and flag that it can still be changed until the panel closes.
function reviewerStatus(decision: QueueCase["decision"]) {
  return decision ? `${decision} • editable` : "needs review";
}

function CaseGrid({ cases }: { cases: Array<QueueCase> }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {cases.map((c) => {
        const isOfficial =
          c.case_type === "official_publish" || c.case_type === "official_edit";
        const isEdit =
          c.case_type === "guide_edit" || c.case_type === "official_edit";

        return (
          <Link
            key={c.id}
            to={ReviewCaseIdRoute.to}
            params={{ caseId: c.id }}
            className="block"
          >
            <div className="rounded-md border bg-background p-4 shadow-none transition-colors hover:bg-muted">
              <div className="flex items-center justify-between">
                <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
                  {isOfficial ? "Official " : ""}
                  {isEdit ? "Guide Revision" : "Guide Creation"}
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

              <div>
                <p className="mt-2 font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
                  {new Date(c.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>

                <CaseTimer expiresAt={c.expires_at} decision={c.decision} />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
