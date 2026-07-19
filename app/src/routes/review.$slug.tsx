import { useState } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";

import type { HydratedGuide } from "@/types/guides";
import { Separator } from "@/components/ui/separator";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { Sidebar } from "@/components/Sidebar";
import { GuideReader } from "@/components/GuideReader";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";

import { getReviewCase } from "@/lib/api/reviews";

import "katex/dist/katex.min.css";

export type Review = {
  decision: string;
  notes: string;
  reasons: Array<string>;
};

export const Route = createFileRoute("/review/$slug")({
  loader: async ({ params, abortController }) => {
    const data = await getReviewCase(params.slug, {
      signal: abortController.signal,
    });
    if (!data.revision) throw notFound();
    return data;
  },
  errorComponent: ReviewDetailError,
  component: RouteComponent,
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

function ReviewDetailError() {
  return (
    <div className="mx-auto max-w-[1280px] border-x bg-background">
      <section className="border-b px-8 py-8 lg:px-16">
        <p className="text-sm text-muted-foreground">
          This review case could not be loaded. Try again shortly.
        </p>
      </section>
    </div>
  );
}

function RouteComponent() {
  const data = Route.useLoaderData();
  if (!data.revision) throw notFound();
  const { revision } = data;

  const [review, setReview] = useState<Review>({
    decision: "",
    notes: "",
    reasons: [],
  });

  // Build a simplified guide object from the revision data for the reader.
  const guide: HydratedGuide = {
    title: revision.title ?? "",
    content: revision.body ?? "",
    summary: revision.summary ?? "",
    author: "",
    created_at: revision.created_at,
    duration: 0,
    tags: [],
    breadcrumbs: [],
    prerequisites: [],
    slug: "",
  };

  return (
    <div className="mx-auto h-[calc(100vh-70px)] max-w-[1280px] border-x bg-background">
      <section className="grid grid-cols-[320px_1fr] border-b">
        <Sidebar
          guide={guide}
          slug={revision.id}
          reviewSection={
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
                <Button className="btn-pri" size="lg">
                  Submit
                </Button>
              </FieldGroup>
            </CollapsibleSection>
          }
        />

        {/* MAIN */}
        <main className="h-[calc(100vh-70px)] min-w-0 overflow-y-auto px-10 py-8 lg:px-16">
          <p className="data-label text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            Review
          </p>
          <Separator className="mb-8" />

          <GuideReader guide={guide} />
        </main>
      </section>
    </div>
  );
}
