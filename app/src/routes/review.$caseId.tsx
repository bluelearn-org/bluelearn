import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { Separator } from "@/components/ui/separator";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";

import { castDecision, getReviewCase } from "@/lib/api/reviews";

import "katex/dist/katex.min.css";

export type Review = {
  decision: string;
  notes: string;
  reasons: Array<string>;
};

export const Route = createFileRoute("/review/$caseId")({
  loader: async ({ params, abortController }) => {
    const data = await getReviewCase(params.caseId, {
      signal: abortController.signal,
    });
    return data;
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { caseId } = Route.useParams();
  const data = Route.useLoaderData();
  const [submitting, setSubmitting] = useState<
    "Submitting..." | "Submitted." | ""
  >("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const reviewCase = data.case;

  const [review, setReview] = useState<Review>({
    decision: "",
    notes: "",
    reasons: [],
  });

  const REASONS = [
    { value: "hierarchy_issue", label: "Hierarchy Issues" },
    { value: "factual_error", label: "Factual Error" },
    { value: "duplicate_content", label: "Duplicate Content" },
    { value: "scope_violation", label: "Scope Violation" },
    { value: "clarity_issue", label: "Clarity Issues" },
    {
      value: "missing_required_information",
      label: "Missing Required Information",
    },
  ];

  const submitDecision = async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setSubmitting("Submitting...");
    setSubmitError(null);

    try {
      await castDecision(caseId, review, { signal: controller.signal });
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setSubmitError("There was an unexpected error with your submission.");
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setSubmitting("Submitted.");
      }
    }
  };

  return (
    <div className="mx-auto h-[calc(100vh-70px)] max-w-[1280px] border-x bg-background">
      <section className="grid grid-cols-[320px_1fr] border-b">
        <aside className="h-[calc(100vh-70px)] overflow-y-auto border-r px-6 py-6">
          <CollapsibleSection
            title={<p className="ml-auto">Submission Review</p>}
            defaultOpen={true}
          >
            <div className="flex justify-around">
              <Button
                className="btn-reject"
                size="lg"
                onClick={() => {
                  if (review.decision == "reject") {
                    setReview((prev) => ({
                      ...prev,
                      decision: "",
                    }));
                  } else {
                    setReview((prev) => ({
                      ...prev,
                      decision: "reject",
                    }));
                  }
                }}
                disabled={review.decision == "approve"}
              >
                Reject
              </Button>
              <Button
                className="btn-approve"
                size="lg"
                onClick={() => {
                  if (review.decision == "approve") {
                    setReview((prev) => ({
                      ...prev,
                      decision: "",
                    }));
                  } else {
                    setReview((prev) => ({
                      ...prev,
                      decision: "approve",
                    }));
                  }
                }}
                disabled={review.decision == "reject"}
              >
                Approve
              </Button>
            </div>

            <FieldGroup>
              <Field className="space-y-2">
                <FieldLabel className="font-mono tracking-[0.08em] uppercase">
                  Notes
                </FieldLabel>

                <textarea
                  className="h-32 w-full min-w-0 resize-none rounded-md border border-input bg-input/20 p-2 text-sm transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-xs/relaxed file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 md:text-xs/relaxed dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
                  rows={4}
                  placeholder="Add notes with more details."
                  required
                  value={review.notes}
                  onChange={(e) =>
                    setReview((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                />
              </Field>

              {review.decision == "reject" && (
                <Field className="space-y-2">
                  <FieldLabel className="font-mono tracking-[0.08em] uppercase">
                    Reasons
                  </FieldLabel>

                  <Combobox
                    multiple
                    items={REASONS}
                    value={review.reasons}
                    onValueChange={(reasons) =>
                      setReview((prev) => ({
                        ...prev,
                        reasons,
                      }))
                    }
                  />
                </Field>
              )}
            </FieldGroup>

            <FieldGroup>
              <Button
                className="btn-pri"
                size="lg"
                onClick={() => {
                  submitDecision();
                }}
              >
                Submit
              </Button>
            </FieldGroup>

            <FieldGroup>
              <p className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
                {submitError === null ? submitting : ""}
              </p>
              <p className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground text-red-500 uppercase">
                {submitError ?? ""}
              </p>
            </FieldGroup>
          </CollapsibleSection>
        </aside>

        {/* MAIN */}
        <main className="h-[calc(100vh-70px)] min-w-0 overflow-y-auto px-10 py-8 lg:px-16">
          <p className="data-label text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            Review
          </p>

          <Separator className="mb-8" />

          <div className="rounded-md border bg-background p-4 shadow-none transition-colors hover:bg-muted">
            <h1 className="mb-2 text-3xl font-bold tracking-tight">
              {reviewCase.title ?? "Untitled Guide"}
            </h1>

            {/* DATE CREATED & CREATOR */}
            <p className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
              {reviewCase.created_by ?? "Anonymous user"} |{" "}
              {new Date(reviewCase.created_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>

            {/* CASE INFO */}
            <div className="space-y-2 p-2 text-sm">
              <p>
                <span className="font-semibold text-gray-900">Status: </span>
                <span className="text-gray-700">
                  {reviewCase.status
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (match) => match.toUpperCase())}
                </span>
              </p>
              <p>
                <span className="font-semibold text-gray-900">Type: </span>
                <span className="text-gray-700">
                  {reviewCase.case_type
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (match) => match.toUpperCase())}
                </span>
              </p>
            </div>

            <p className="mt-2 font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase italic">
              (Last Updated{" "}
              {new Date(reviewCase.created_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              )
            </p>
          </div>
        </main>
      </section>
    </div>
  );
}
