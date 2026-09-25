import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { ArrowLeft, GitCommit } from "lucide-react";

import type { ObjectiveRevisionDiff as ObjectiveRevisionDiffData } from "@bluelearn/schemas";
import ObjectiveFlow from "@/components/objective/ObjectiveFlow";
import { ObjectiveRevisionDiff } from "@/components/objective/ObjectiveRevisionDiff";
import { Separator } from "@/components/ui/separator";

import { ApiError } from "@/lib/api/apiHelpers";
import { listGuides } from "@/lib/api/guides";
import { listObjectiveRevisions } from "@/lib/api/objectives";
import {
  getObjectiveRevision,
  getObjectiveRevisionDiff,
} from "@/lib/api/objectiveRevisions";
import {
  buildObjectiveFlow,
  buildSubObjectives,
  stepLabel,
} from "@/lib/objectiveSnapshot";
import { formatDate } from "@/lib/guideUtils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/objectives/$slug/revisions/$revisionId")(
  {
    loader: async ({ params, abortController }) => {
      const signal = abortController.signal;

      try {
        const [{ revisions }, detail, guides] = await Promise.all([
          listObjectiveRevisions(params.slug, { limit: 100 }, { signal }),
          getObjectiveRevision(params.revisionId, { signal }),
          listGuides({ signal }),
        ]);

        const index = revisions.findIndex(
          (rev) => rev.id === params.revisionId
        );
        if (index === -1) throw notFound();

        return {
          entry: revisions[index],
          previousId: revisions[index + 1]?.id ?? null,
          detail,
          guides,
        };
      } catch (err) {
        if (
          err instanceof ApiError &&
          (err.status === 403 || err.status === 404)
        )
          throw notFound();
        throw err;
      }
    },
    component: RouteComponent,
  }
);

function RouteComponent() {
  const { slug, revisionId } = Route.useParams();
  const { entry, previousId, detail, guides } = Route.useLoaderData();

  const [view, setView] = useState<"objective" | "changes">("objective");
  const [diff, setDiff] = useState<ObjectiveRevisionDiffData | null>(null);
  const [diffFailed, setDiffFailed] = useState(false);

  useEffect(() => {
    if (!previousId || view !== "changes" || diff || diffFailed) return;

    const controller = new AbortController();

    getObjectiveRevisionDiff(previousId, revisionId, {
      signal: controller.signal,
    })
      .then((data) => setDiff(data as ObjectiveRevisionDiffData))
      .catch((err: Error) => {
        if (err.name !== "AbortError") setDiffFailed(true);
      });

    return () => controller.abort();
  }, [revisionId, previousId, view, diff, diffFailed]);

  const displayDate = entry.published_at ?? entry.created_at;

  const { targets } = useMemo(
    () => buildObjectiveFlow(detail.snapshot, guides),
    [detail.snapshot, guides]
  );

  const creationDiff = useMemo<ObjectiveRevisionDiffData | null>(() => {
    if (previousId) return null;

    const ref = { id: revisionId, created_at: displayDate };
    const addedField = (text: string | null) =>
      text
        ? {
            changed: true,
            lines: text
              .split("\n")
              .map((line) => ({ type: "added" as const, text: line })),
          }
        : { changed: false, lines: null };

    return {
      from: ref,
      to: ref,
      fields: {
        title: addedField(detail.revision.title),
        summary: addedField(detail.revision.summary),
      },
      // The objective did not exist before, so every sub-objective and every
      // step of its sequence reads as an addition.
      targets: buildSubObjectives(detail.snapshot).map(({ target, steps }) => ({
        guide_base_id: target.guide_base_id!,
        slug: target.slug,
        title: target.title,
        status: "added" as const,
        lines: steps.map((step) => ({
          type: "added" as const,
          text: stepLabel(step),
        })),
        changed: [],
      })),
    };
  }, [previousId, revisionId, displayDate, detail]);

  const changes = previousId ? diff : creationDiff;

  return (
    <div className="mx-auto min-h-[calc(100vh-70px)] max-w-7xl bg-background">
      <main className="min-w-0 px-4 py-8 md:px-10 lg:px-16">
        <Link
          to="/objectives/$slug"
          params={{ slug }}
          className="mono-micro inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to objective
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="mono-micro flex items-center gap-1.5">
            <GitCommit className="h-3.5 w-3.5" />
            {revisionId.slice(0, 8)}
          </span>
          {entry.author && <span>·</span>}
          {entry.author && <span>by @{entry.author}</span>}
          <span>·</span>
          <span>{formatDate(new Date(displayDate))}</span>
        </div>

        <p className="mt-1.5 text-lg font-bold">
          {entry.change_summary || "Initial version or update"}
        </p>

        <Separator className="mt-6" />

        <div className="mt-6 inline-flex gap-1 border-b">
          {(["objective", "changes"] as const).map((tab) => (
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
              {tab === "objective" ? "Objective" : "Changes"}
            </button>
          ))}
        </div>

        <div className={cn("mt-6", view !== "objective" && "hidden")}>
          {targets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This revision has no sub-objectives.
            </p>
          ) : (
            <ObjectiveFlow
              objective={{ ...detail.revision, slug }}
              targets={targets}
            />
          )}
        </div>

        <div className={cn("mt-6", view !== "changes" && "hidden")}>
          {previousId && diffFailed ? (
            <p className="mono-micro text-red-500">
              Could not load the changes for this revision.
            </p>
          ) : !changes ? (
            <p className="mono-micro text-muted-foreground">
              Loading changes...
            </p>
          ) : (
            <ObjectiveRevisionDiff diff={changes} />
          )}
        </div>
      </main>
    </div>
  );
}
