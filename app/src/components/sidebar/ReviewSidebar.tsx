import { toast } from "sonner";
import { Check, ExternalLink, Scroll, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ChangeRow } from "@/components/review/ChangeRow";
import { ChangeSection } from "@/components/review/ChangeSection";
import { DecisionList } from "@/components/review/DecisionList";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";

import { cn } from "@/lib/utils";
import { deadlineTickMs, formatTimeRemaining } from "@/lib/reviewDeadline";
import { castDecision } from "@/lib/api/reviews";
import { getRevision, reviseRevision } from "@/lib/api/guideRevisions";
import { GuidelinesModal } from "@/components/modals/GuidelinesModal";

export type Review = {
  decision: string;
  notes: string;
  reasons: Array<string>;
};

type PropTypes = {
  caseId: string;
  revision: any;
  revisionData: any;
};

const DetailRow = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  <div className="flex items-center justify-between gap-2 text-xs">
    <span className="text-muted-foreground">{label}</span>
    {value}
  </div>
);

export const ReviewSidebar = ({
  caseId,
  revision,
  revisionData,
}: PropTypes) => {
  const [openGuidelineModal, setOpenGuidelineModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [revising, setRevising] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const navigate = useNavigate();
  const router = useRouter();

  const toggleGuidelineModal = () => setOpenGuidelineModal(!openGuidelineModal);

  const subjects = revision?.tags ?? [];

  const isEdit = revisionData.case.case_type === "guide_edit";

  const priorDecision = revisionData.viewer_decision;
  const hasVoted = priorDecision !== null;

  const seatStatus = revisionData.viewer_seat_status ?? null;
  const seatLive = seatStatus === "assigned";
  const expiresMs = revisionData.viewer_expires_at
    ? new Date(revisionData.viewer_expires_at).getTime()
    : null;

  const [now, setNow] = useState(() => Date.now());
  const invalidated = useRef(false);

  useEffect(() => {
    if (!seatLive || expiresMs === null) return;

    const diffMs = expiresMs - Date.now();
    if (diffMs <= 0) {
      if (invalidated.current) return;
      invalidated.current = true;
      router.invalidate();
      return;
    }

    const timer = setTimeout(() => setNow(Date.now()), deadlineTickMs(diffMs));
    return () => clearTimeout(timer);
  }, [seatLive, expiresMs, now, router]);

  const diffMs = seatLive && expiresMs !== null ? expiresMs - now : null;
  const timedOut =
    seatStatus === "replaced" || (diffMs !== null && diffMs <= 0);

  const caseOpen =
    revisionData.case.status !== "approved" &&
    revisionData.case.status !== "rejected";

  const validateReview = () => {
    if (review.decision === "")
      return "Choose approve or reject before submitting";
    if (review.decision === "approve") return "";

    const missing = [];
    if (review.reasons.length === 0) missing.push("at least one reason");
    if (review.notes.length === 0) missing.push("a note");

    return missing.length === 0
      ? ""
      : `Rejections require ${missing.join(" and ")}`;
  };

  const submitDecision = async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const missingFields = validateReview();
    if (missingFields.length !== 0) {
      toast.error(missingFields);
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading("Submitting decision...");

    try {
      await castDecision(caseId, review, { signal: controller.signal });
      toast.success(hasVoted ? "Decision updated" : "Decision submitted", {
        id: toastId,
      });
      router.invalidate();
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        const message =
          e instanceof Error && e.message
            ? e.message
            : "There was an unexpected error with your submission";
        toast.error(message, {
          id: toastId,
        });
      } else {
        toast.dismiss(toastId);
      }
      setSubmitting(false);
    }
  };

  const canVote = revisionData.viewer_role === "panelist" && caseOpen;

  const canRevise =
    revisionData.viewer_role === "author" &&
    revisionData.case.status === "rejected" &&
    revision;

  const startRevision = async () => {
    setRevising(true);
    const toastId = toast.loading("Opening your revision...");

    try {
      const draftId = await reviseRevision(revision.id);
      const draft = await getRevision(draftId);
      toast.dismiss(toastId);

      if (draft.base_slug && draft.variant_slug) {
        navigate({
          to: "/guides/$slug/$variantSlug/edit",
          params: { slug: draft.base_slug, variantSlug: draft.variant_slug },
          search: { draft: draftId },
        });
      } else {
        navigate({ to: "/contribute", search: { draft: draftId } });
      }
    } catch {
      toast.error("Could not open your revision", { id: toastId });
      setRevising(false);
    }
  };

  const [review, setReview] = useState<Review>({
    decision:
      priorDecision === null
        ? ""
        : priorDecision.decision === "approved"
          ? "approve"
          : "reject",
    notes: priorDecision?.notes ?? "",
    reasons: priorDecision?.reasons ?? [],
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

  return (
    <aside className="border-b md:border-r md:border-b-0">
      <div className="sticky top-[65px] max-h-[calc(100vh-65px)] space-y-4 overflow-y-auto px-6 py-6">
        <CollapsibleSection
          defaultOpen={true}
          title={<p className="ml-auto">Submission Details</p>}
        >
          <div className="space-y-2">
            <DetailRow
              label="Case Type"
              value={
                <Badge
                  variant="outline"
                  className="border-badge-border bg-badge font-mono tracking-[0.06em] text-badge-foreground uppercase"
                >
                  {isEdit ? "Guide Revision" : "Guide Creation"}
                </Badge>
              }
            />
            <DetailRow
              label="Author"
              value={
                <Badge
                  variant="outline"
                  className="border-badge-border bg-badge font-mono tracking-[0.06em] text-badge-foreground uppercase"
                >
                  {revision?.author_username
                    ? `@${revision.author_username}`
                    : "Unknown"}
                </Badge>
              }
            />
            {isEdit && revision?.base && (
              <DetailRow
                label="Guide"
                value={
                  <Link
                    to="/guides/$slug"
                    params={{ slug: revision.base.slug }}
                    className="flex min-w-0 items-center gap-1 leading-none text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <span className="max-w-[18ch] truncate">
                      {revision.base.title ?? revision.base.slug}
                    </span>
                    <ExternalLink
                      className="size-3 shrink-0 -translate-y-0.5"
                      strokeWidth={2.75}
                    />
                  </Link>
                }
              />
            )}
          </div>
        </CollapsibleSection>

        {canVote && (
          <CollapsibleSection
            defaultOpen={true}
            title={<p className="ml-auto">Review Decision</p>}
          >
            <section className="space-y-4">
              {timedOut && (
                <DetailRow
                  label="Time Remaining"
                  value={
                    <span className="font-mono text-xs text-destructive">
                      Expired
                    </span>
                  }
                />
              )}

              {!timedOut && diffMs !== null && (
                <DetailRow
                  label="Time Remaining"
                  value={
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatTimeRemaining(diffMs)}
                    </span>
                  }
                />
              )}

              <FieldGroup>
                <Field className="space-y-4">
                  <button
                    type="button"
                    className="btn-sec inline-flex items-center gap-2 disabled:pointer-events-none disabled:opacity-50"
                    onClick={toggleGuidelineModal}
                  >
                    <Scroll className="size-4" />
                    View Guidelines
                  </button>
                </Field>

                <Field className="space-y-4">
                  <FieldLabel className="font-mono tracking-[0.08em] uppercase">
                    Vote
                  </FieldLabel>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className={cn(
                        "h-9 border-red-500/40 font-mono text-xs font-bold text-red-600 uppercase transition-colors hover:bg-red-500/10 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400",
                        review.decision === "reject" &&
                          "border-red-600 bg-red-600 text-white hover:bg-red-600 hover:text-white dark:border-red-600 dark:bg-red-600 dark:text-white dark:hover:text-white",
                        review.decision === "approve" &&
                          "opacity-40 hover:opacity-100"
                      )}
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
                    >
                      <X />
                      Reject
                    </Button>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-9 border-green-600/40 font-mono text-xs font-bold text-green-700 uppercase transition-colors hover:bg-green-600/10 hover:text-green-700 dark:text-green-400 dark:hover:text-green-400",
                        review.decision === "approve" &&
                          "border-green-600 bg-green-600 text-white hover:bg-green-600 hover:text-white dark:border-green-600 dark:bg-green-600 dark:text-white dark:hover:text-white",
                        review.decision === "reject" &&
                          "opacity-40 hover:opacity-100"
                      )}
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
                    >
                      <Check />
                      Approve
                    </Button>
                  </div>
                </Field>
              </FieldGroup>

              <FieldGroup className="gap-4">
                <Field className="space-y-2">
                  <FieldLabel className="font-mono tracking-[0.08em] uppercase">
                    Notes
                  </FieldLabel>

                  <textarea
                    className="h-32 w-full min-w-0 resize-none rounded-md border border-input bg-input/20 p-2 text-sm transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-xs/relaxed file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 md:text-xs/relaxed dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
                    rows={4}
                    placeholder="Add notes to explain your decision..."
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
                    <FieldLabel className="font-mono font-bold tracking-[0.08em] uppercase">
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

              <Button
                className="btn-pri w-full py-2.5"
                size="lg"
                disabled={submitting || timedOut}
                onClick={() => {
                  submitDecision();
                }}
              >
                {hasVoted ? "Update Decision" : "Submit Decision"}
              </Button>
            </section>
          </CollapsibleSection>
        )}

        {!caseOpen && (
          <CollapsibleSection
            defaultOpen={true}
            title={<p className="ml-auto">Panel Decisions</p>}
          >
            <section className="space-y-4">
              <DecisionList decisions={revisionData.decisions} />

              {canRevise && (
                <Button
                  className="btn-pri w-full py-2.5"
                  size="lg"
                  disabled={revising}
                  onClick={() => {
                    startRevision();
                  }}
                >
                  {revisionData.revise_draft_id
                    ? "Continue revision"
                    : "Revise submission"}
                </Button>
              )}
            </section>
          </CollapsibleSection>
        )}

        {isEdit && (
          <CollapsibleSection
            defaultOpen={true}
            title={<p className="ml-auto">Change Summary</p>}
          >
            {revision?.change_summary ? (
              <p className="text-xs leading-relaxed whitespace-pre-wrap">
                {revision.change_summary}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                The author left no summary of what changed.
              </p>
            )}
          </CollapsibleSection>
        )}

        <section className="space-y-2">
          <CollapsibleSection
            defaultOpen={true}
            title={<p className="ml-auto">Proposed Subjects</p>}
          >
            <ChangeSection count={subjects.length} empty="None proposed.">
              {subjects.map(
                (s: { id: string; name: string; status: string }) => (
                  <ChangeRow
                    key={s.id}
                    label={s.name}
                    badge={
                      s.status === "draft" ? (
                        <Badge
                          variant="outline"
                          className="border-transparent bg-brand-bright-blue/15 font-mono tracking-[0.06em] text-brand-dark-navy uppercase dark:text-brand-bright-blue"
                        >
                          New
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-transparent bg-muted-foreground/8 font-mono tracking-[0.06em] text-muted-foreground uppercase"
                        >
                          Existing
                        </Badge>
                      )
                    }
                  />
                )
              )}
            </ChangeSection>
          </CollapsibleSection>

          {!isEdit && revisionData.claimed_todos.length > 0 && (
            <CollapsibleSection
              defaultOpen={true}
              title={<p className="ml-auto">Claimed Todos</p>}
            >
              <div className="space-y-3">
                <ul className="space-y-3">
                  {revisionData.claimed_todos.map(
                    (t: {
                      id: string;
                      title: string;
                      summary: string;
                      requested_by: {
                        slug: string;
                        title: string | null;
                      } | null;
                    }) => (
                      <li key={t.id} className="space-y-1 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate">{t.title}</span>
                          {t.requested_by && (
                            <Link
                              to="/guides/$slug"
                              params={{ slug: t.requested_by.slug }}
                              className="flex min-w-0 items-center gap-1 leading-none text-muted-foreground transition-colors hover:text-foreground"
                            >
                              <span className="max-w-[14ch] truncate">
                                {t.requested_by.title ?? t.requested_by.slug}
                              </span>
                              <ExternalLink
                                className="size-3 shrink-0 -translate-y-0.5"
                                strokeWidth={2.75}
                              />
                            </Link>
                          )}
                        </div>
                        <p className="text-muted-foreground">{t.summary}</p>
                      </li>
                    )
                  )}
                </ul>

                <p className="text-xs text-muted-foreground">
                  Approving this submission marks these as resolved.
                </p>
              </div>
            </CollapsibleSection>
          )}

          {!isEdit && (
            <CollapsibleSection
              defaultOpen={true}
              title={<p className="ml-auto">Prerequisite Guides</p>}
            >
              <ChangeSection
                count={
                  revisionData.prerequisites.length + revisionData.todos.length
                }
                empty="None declared"
              >
                {revisionData.prerequisites.map(
                  (p: { slug: string; title?: string }) => (
                    <ChangeRow
                      key={p.slug}
                      label={p.title ?? p.slug}
                      badge={
                        <Badge
                          variant="outline"
                          className="border-transparent bg-muted-foreground/8 font-mono tracking-[0.06em] text-muted-foreground uppercase"
                        >
                          Existing
                        </Badge>
                      }
                    />
                  )
                )}

                {revisionData.todos.map((t: { id: string; title: string }) => (
                  <ChangeRow
                    key={t.id}
                    label={t.title}
                    badge={
                      <Badge
                        variant="outline"
                        className="border-transparent bg-brand-bright-blue/15 font-mono tracking-[0.06em] text-brand-dark-navy uppercase dark:text-brand-bright-blue"
                      >
                        Todo
                      </Badge>
                    }
                  />
                ))}
              </ChangeSection>
            </CollapsibleSection>
          )}

          <GuidelinesModal
            open={openGuidelineModal}
            onOpenChange={toggleGuidelineModal}
          />
        </section>
      </div>
    </aside>
  );
};
