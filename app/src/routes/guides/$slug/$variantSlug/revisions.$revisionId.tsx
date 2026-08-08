import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { ArrowLeft, GitCommit } from "lucide-react";

import type { ReaderGuide } from "@/components/GuideReader";
import type { FieldDiff, RevisionDiffData } from "@/components/RevisionDiff";
import { GuideReader } from "@/components/GuideReader";
import { RevisionDiff } from "@/components/RevisionDiff";

import { ApiError } from "@/lib/api/apiHelpers";
import { getVariantBySlug, getVariantRevisions } from "@/lib/api/variants";
import { getRevision, getRevisionDiff } from "@/lib/api/guideRevisions";
import { formatDate } from "@/lib/guideUtils";
import { cn } from "@/lib/utils";

import "katex/dist/katex.min.css";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute(
  "/guides/$slug/$variantSlug/revisions/$revisionId"
)({
  loader: async ({ params, abortController }) => {
    const signal = abortController.signal;

    try {
      const variant = await getVariantBySlug(params.slug, params.variantSlug, {
        signal,
      });

      const [{ revisions }, detail] = await Promise.all([
        getVariantRevisions(variant.id, { signal }),
        getRevision(params.revisionId, { signal }),
      ]);

      const index = revisions.findIndex((rev) => rev.id === params.revisionId);
      if (index === -1) throw notFound();

      return {
        variant,
        entry: revisions[index],
        detail,
        hasPrevious: index < revisions.length - 1,
      };
    } catch (err) {
      if (err instanceof ApiError && (err.status === 403 || err.status === 404))
        throw notFound();
      throw err;
    }
  },
  component: RouteComponent,
});

function addedField(text: string | null): FieldDiff {
  if (!text) return { changed: false, lines: null };

  return {
    changed: true,
    lines: text.split("\n").map((line) => ({ type: "added", text: line })),
  };
}

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

  return (
    <RevisionDiff
      diff={diff}
      fromLabel="Previous version"
      toLabel="This revision"
    />
  );
}

function RouteComponent() {
  const { slug, variantSlug, revisionId } = Route.useParams();
  const { variant, entry, detail, hasPrevious } = Route.useLoaderData();

  const [view, setView] = useState<"guide" | "changes">("guide");
  const [diff, setDiff] = useState<RevisionDiffData | null>(null);
  const [diffFailed, setDiffFailed] = useState(false);

  useEffect(() => {
    if (!hasPrevious || view !== "changes" || diff || diffFailed) return;

    const controller = new AbortController();

    getRevisionDiff(revisionId, { signal: controller.signal })
      .then((data) => setDiff(data as RevisionDiffData))
      .catch((err: Error) => {
        if (err.name !== "AbortError") setDiffFailed(true);
      });

    return () => controller.abort();
  }, [revisionId, hasPrevious, view, diff, diffFailed]);

  const publishedAt = entry.approved_at;

  const creationDiff = useMemo<RevisionDiffData | null>(() => {
    if (hasPrevious) return null;

    const ref = { id: revisionId, created_at: publishedAt };
    return {
      from: ref,
      to: ref,
      fields: {
        title: addedField(detail.revision.title),
        summary: addedField(detail.revision.summary),
        body: addedField(detail.revision.body),
      },
    };
  }, [hasPrevious, revisionId, publishedAt, detail]);

  const guideContent = useMemo(() => {
    const guide: ReaderGuide = {
      slug,
      variant_slug: variantSlug,
      title: detail.revision.title ?? "",
      author: entry.author ?? "",
      summary: detail.revision.summary,
      body: detail.revision.body,
      duration_minutes: variant.duration_minutes,
      created_at: publishedAt,
      tags: variant.tags,
      prerequisites: [],
    };

    return (
      <GuideReader
        guide={guide}
        guideType={detail.knowledge_type ?? undefined}
        showToc
      />
    );
  }, [slug, variantSlug, detail, entry, variant, publishedAt]);

  return (
    <div className="mx-auto max-w-7xl bg-background">
      <main className="min-w-0 px-4 py-8 md:px-10 lg:px-16">
        <Link
          to="/guides/$slug/$variantSlug"
          params={{ slug, variantSlug }}
          className="mono-micro inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to guide
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="mono-micro flex items-center gap-1.5">
            <GitCommit className="h-3.5 w-3.5" />
            {revisionId.slice(0, 8)}
          </span>
          {entry.author && <span>·</span>}
          {entry.author && <span>by @{entry.author}</span>}
          <span>·</span>
          <span>{formatDate(new Date(publishedAt))}</span>
        </div>

        <p className="mt-1.5 text-lg font-bold">
          {entry.change_summary || "Initial version or update"}
        </p>

        <Separator className="mt-6" />

        <div className="mt-6 inline-flex gap-1 border-b">
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

        <div className={cn("mt-6", view !== "guide" && "hidden")}>
          {guideContent}
        </div>

        <div className={cn("mt-6", view !== "changes" && "hidden")}>
          <DiffPane
            diff={hasPrevious ? diff : creationDiff}
            failed={hasPrevious && diffFailed}
          />
        </div>
      </main>
    </div>
  );
}
