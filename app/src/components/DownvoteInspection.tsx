import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { DownvoteInspection as Inspection } from "@bluelearn/schemas";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/apiHelpers";
import { downvoteReasonItems, inspectDownvotes } from "@/lib/api/votes";
import { useAuth } from "@/lib/authContext";

type Target = { guideId: string } | { caseId: string };

export function DownvoteInspection({ target }: { target: Target }) {
  const { user, roles, rolesLoading } = useAuth();
  if (!user || rolesLoading || roles.length === 0) return null;

  const targetId = "guideId" in target ? target.guideId : target.caseId;

  return <InspectionPanel key={`${user.id}:${targetId}`} target={target} />;
}

function InspectionPanel({ target }: { target: Target }) {
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Inspection | null>(null);
  const [status, setStatus] = useState<
    "loading" | "ready" | "denied" | "failed"
  >("loading");
  const guideId = "guideId" in target ? target.guideId : undefined;
  const caseId = "caseId" in target ? target.caseId : undefined;

  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => setAttempt((value) => value + 1);
    const currentTarget = guideId ? { guideId } : { caseId: caseId! };
    setResult(null);
    setStatus("loading");

    inspectDownvotes(currentTarget, page, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;

        setResult(data);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;

        const denied =
          error instanceof ApiError && [401, 403, 404].includes(error.status);
        setStatus(denied ? "denied" : "failed");
      });

    window.addEventListener("focus", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("focus", refresh);
    };
  }, [guideId, caseId, page, attempt]);

  if (status === "denied") return null;

  return (
    <section
      aria-label="Downvote inspection"
      className="mt-8 space-y-4 border-t py-6"
    >
      <h2 className="font-mono text-sm font-semibold">Downvote inspection</h2>
      <p className="text-sm text-muted-foreground">
        Private voter details for moderation and assigned reviews.
      </p>
      {status === "loading" && <p role="status">Loading downvotes...</p>}
      {status === "failed" && (
        <div role="alert" className="space-y-2">
          <p>Could not load downvotes.</p>
          <Button
            variant="outline"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Try again
          </Button>
        </div>
      )}
      {result && (
        <>
          {result.total === 0 ? (
            <p>No current downvotes.</p>
          ) : (
            <ul className="divide-y">
              {result.votes.map((vote) => (
                <li key={vote.voter_id} className="space-y-2 py-4">
                  {vote.username ? (
                    <Link
                      to="/profile/$username"
                      params={{ username: vote.username }}
                      className="text-brand-bright-blue underline"
                    >
                      @{vote.username}
                    </Link>
                  ) : (
                    <span>{vote.voter_id}</span>
                  )}
                  <p className="text-sm font-medium">
                    {
                      downvoteReasonItems.find(
                        (item) => item.value === vote.reason
                      )?.label
                    }
                  </p>
                  {vote.note && (
                    <p className="text-sm break-words whitespace-pre-wrap">
                      {vote.note}
                    </p>
                  )}
                  <time
                    dateTime={vote.updated_at}
                    className="text-xs text-muted-foreground"
                  >
                    {new Date(vote.updated_at).toLocaleString()}
                  </time>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Previous
            </Button>
            <span className="text-sm">Page {page}</span>
            <Button
              variant="outline"
              disabled={page * 20 >= result.total}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
