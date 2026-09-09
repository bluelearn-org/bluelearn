import { useEffect, useMemo, useState } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";

import type { ReaderGuide } from "@/components/GuideReader";
import type { RevisionDiffData } from "@/components/RevisionDiff";
import { GuideReader } from "@/components/GuideReader";
import { RevisionDiff } from "@/components/RevisionDiff";

import { ApiError } from "@/lib/api/apiHelpers";
import { getReviewCase } from "@/lib/api/reviews";
import { getRevisionDiff } from "@/lib/api/guideRevisions";
import { cn } from "@/lib/utils";

import "katex/dist/katex.min.css";
import { ReviewSidebar } from "@/components/sidebar/ReviewSidebar";

export const Route = createFileRoute("/review/$caseId")({
  loader: async ({ params, abortController }) => {
    try {
      return await getReviewCase(params.caseId, {
        signal: abortController.signal,
      });
    } catch (err) {
      // The API decides who may read a case, so treat a refusal as a dead link
      if (err instanceof ApiError && (err.status === 403 || err.status === 404))
        throw notFound();
      throw err;
    }
  },
  component: RouteComponent,
});

function DiffPane({
  diff,
  failed,
}: {
  diff: RevisionDiffData | null;
  failed: boolean;
}) {
  if (failed)
    return (
      <p className="mono-micro text-red-500">
        Could not load the changes for this revision.
      </p>
    );

  if (!diff)
    return (
      <p className="mono-micro text-muted-foreground">Loading changes...</p>
    );

  return <RevisionDiff diff={diff} />;
}

function RouteComponent() {
  const { caseId } = Route.useParams();
  const revisionData = Route.useLoaderData();

  const revision = revisionData.revision;

  // Only an edit has something to be compared against. A creation is the first
  // version of its guide, so there is no live revision to diff against.
  const isEdit =
    revisionData.case.case_type === "guide_edit" ||
    revisionData.case.case_type === "official_edit";

  const [view, setView] = useState<"guide" | "changes">("guide");
  const [diff, setDiff] = useState<RevisionDiffData | null>(null);
  const [diffFailed, setDiffFailed] = useState(false);

  useEffect(() => {
    if (!revision || view !== "changes" || diff || diffFailed) return;

    const controller = new AbortController();

    getRevisionDiff(revision.id, { signal: controller.signal })
      .then((data) => setDiff(data as RevisionDiffData))
      .catch((err: Error) => {
        if (err.name !== "AbortError") setDiffFailed(true);
      });

    return () => controller.abort();
  }, [revision, view, diff, diffFailed]);

  // Prevent guide content from re-rendering on each review action change.
  const guideContent = useMemo(() => {
    if (!revision) return null;

    const guide: ReaderGuide = {
      slug: "",
      variant_slug: null,
      title: revision.title ?? "",
      author: revision.author_username,
      summary: revision.summary ?? null,
      body: revision.body ?? null,
      duration_minutes: revision.duration_minutes,
      created_at: revision.created_at,
      tags: revision.tags,
      prerequisites: [],
      disclaimers: [],
    };

    return (
      <GuideReader
        guide={guide}
        guideType={revision.knowledge_type ?? undefined}
      />
    );
  }, [revision]);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-65px)] max-w-7xl flex-col bg-background">
      <section className="flex flex-1 flex-col border-b md:grid md:grid-cols-[320px_1fr]">
        <ReviewSidebar
          caseId={caseId}
          revision={revision}
          revisionData={revisionData}
        />

        {/* MAIN */}
        <main className="min-w-0 px-4 pt-8 pb-6 md:px-10 lg:px-16">
          {isEdit && revision && (
            <div className="mb-6 inline-flex gap-1 border-b">
              {(["guide", "changes"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={cn(
                    "mono-micro -mb-px border-b-2 border-transparent px-3 py-1.5 tracking-[0.08em] text-muted-foreground uppercase transition-colors hover:text-foreground",
                    view === tab &&
                      "border-brand-bright-blue text-brand-bright-blue"
                  )}
                  onClick={() => setView(tab)}
                >
                  {tab === "guide" ? "Guide" : "Changes"}
                </button>
              ))}
            </div>
          )}

          <div className={cn(view !== "guide" && "hidden")}>
            {guideContent ?? (
              <p className="font-mono text-[11px] tracking-[0.08em] text-red-500 uppercase">
                No guide revision found to display.
              </p>
            )}
          </div>

          {isEdit && (
            <div className={cn(view !== "changes" && "hidden")}>
              <DiffPane diff={diff} failed={diffFailed} />
            </div>
          )}
        </main>
      </section>
    </div>
  );
}
