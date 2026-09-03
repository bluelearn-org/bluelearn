import { defineStepper } from "@stepperize/react";
import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { ReaderGuide } from "@/components/GuideReader";
import type { GuideContribution } from "@/types/contributions";
import type { GuideType } from "@/types/guides";

import { listGuides } from "@/lib/api/guides";
import { getMyIdentity } from "@/lib/api/identity";
import { listSubjects } from "@/lib/api/subjects";
import {
  getRevision,
  submitRevision,
  updateRevision,
} from "@/lib/api/guideRevisions";
import { createVariantRevision, getVariantBySlug } from "@/lib/api/variants";
import { uploadMedia } from "@/lib/api/media";
import {
  estimateReadMinutes,
  isRevisionDraftUnchanged,
} from "@/lib/guideUtils";
import { requireSession } from "@/lib/auth";

import { EditGuideInfo } from "@/components/contribute/steps/guide/EditGuideInfo";
import { Submit } from "@/components/contribute/steps/Submit";
import { RejectionFeedback } from "@/components/review/RejectionFeedback";
import { MobileStepProgress } from "@/components/contribute/MobileStepProgress";

export const Route = createFileRoute("/guides/$slug/$variantSlug/edit")({
  ssr: false,
  beforeLoad: requireSession,

  validateSearch: (search: Record<string, unknown>): { draft?: string } => ({
    draft: typeof search.draft === "string" ? search.draft : undefined,
  }),

  loaderDeps: ({ search }) => ({
    draft: search.draft,
  }),

  loader: async ({ params, deps }) => {
    const variant = await getVariantBySlug(params.slug, params.variantSlug);

    // a variant with nothing published has no snapshot to revise
    if (!variant.current) {
      throw notFound();
    }

    // if a draft ID is provided, resume that draft
    // otherwise - seed the editor from the currently published revision
    const snapshot = await getRevision(deps.draft ?? variant.current.id);

    return {
      variant,
      current: variant.current,
      snapshot,
      draftId: deps.draft ?? null,
    };
  },

  component: RouteComponent,
});

const editSteps = [
  {
    id: "guide-info",
    title: "Edit Guide",
  },
  {
    id: "submit",
    title: "Preview",
  },
] as const;

const StepperInstance = defineStepper(editSteps);

function RouteComponent() {
  const { variant, current, snapshot, draftId } = Route.useLoaderData();

  const { Stepper } = StepperInstance;
  const router = useRouter();

  /*
   * Subjects are split into:
   * - approved subjects - can be selected normally
   * - pending subjects - remain in newSubjects
   */
  const approved = snapshot.subjects.filter(
    (subject) => subject.status === "published"
  );

  const pending = snapshot.subjects.filter(
    (subject) => subject.status !== "published"
  );

  const [guideContData, setGuideContData] = useState<GuideContribution>(() => ({
    type: snapshot.knowledge_type === "practical" ? "practical" : "theoretical",

    title: snapshot.revision.title ?? "",
    summary: snapshot.revision.summary ?? "",
    body: snapshot.revision.body ?? "",

    subjects: approved.map((subject) => subject.id),

    newSubjects: pending.map((subject) => ({
      id: subject.id,
      name: subject.name,
      summary: subject.summary ?? "",
    })),

    prereqs: snapshot.prerequisites,
    todoPrereqs: snapshot.todos,
  }));

  const [changeSummary, setChangeSummary] = useState(
    snapshot.revision.change_summary ?? ""
  );

  const [revisionId, setRevisionId] = useState<string | null>(draftId);

  const [submitting, setSubmitting] = useState(false);

  // must match one of the IDs
  const [activeStep, setActiveStep] = useState("guide-details");

  const [subjectOptions, setSubjectOptions] = useState<
    Array<{ id: string; name: string }>
  >(() =>
    approved.map((subject) => ({
      id: subject.id,
      name: subject.name,
    }))
  );

  const [guideOptions, setGuideOptions] = useState<
    Awaited<ReturnType<typeof listGuides>>
  >([]);

  const [username, setUsername] = useState<string | null>(null);

  // load subjects, guides and the user's identity
  useEffect(() => {
    const controller = new AbortController();

    const opts = {
      signal: controller.signal,
    };

    listSubjects(opts)
      .then((data) => {
        setSubjectOptions((previous) => {
          const listed = new Set(data.map((subject) => subject.id));

          return [
            ...data,
            ...previous.filter((subject) => !listed.has(subject.id)),
          ];
        });
      })
      .catch(() => {});

    listGuides(opts)
      .then(setGuideOptions)
      .catch(() => {});

    getMyIdentity(opts)
      .then((data) => {
        setUsername(data.profile.username);
      })
      .catch(() => {});

    return () => controller.abort();
  }, []);

  // build the guide shown in the preview step
  const previewGuide: ReaderGuide = useMemo(() => {
    const nameById = new Map(
      subjectOptions.map((subject) => [subject.id, subject.name])
    );

    const titleBySlug = new Map(
      guideOptions
        .filter((guide) => guide.slug)
        .map((guide) => [
          guide.slug as string,
          guide.title ?? (guide.slug as string),
        ])
    );

    return {
      slug: snapshot.base_slug ?? "",
      variant_id: variant.id,
      variant_slug: variant.slug,

      title: guideContData.title || "Untitled guide",

      author: username ?? "",

      summary: guideContData.summary,

      body: guideContData.body,

      duration_minutes: estimateReadMinutes(guideContData.body),

      created_at: current.created_at,

      tags: [
        ...guideContData.subjects.map((id) => ({
          slug: id,
          name: nameById.get(id) ?? id,
        })),

        ...guideContData.newSubjects.map((subject) => ({
          slug: subject.name,
          name: subject.name,
        })),
      ],

      prerequisites: guideContData.prereqs.map((slug) => ({
        slug,
        title: titleBySlug.get(slug) ?? slug,
      })),
    };
  }, [
    guideContData,
    subjectOptions,
    guideOptions,
    username,
    snapshot,
    variant,
    current,
  ]);

  // knowledge type belongs to the guide base
  const guideType: GuideType | undefined =
    snapshot.knowledge_type === "practical" ||
    snapshot.knowledge_type === "theoretical"
      ? snapshot.knowledge_type
      : undefined;

  /*
   * Only revision fields are persisted when editing
   * Type, prerequisites and TODO prerequisites belong to
   * guide base and not submitted as part of a revision
   */
  const draftFields = () => ({
    title: guideContData.title || null,

    summary: guideContData.summary || null,

    body: guideContData.body || null,

    change_summary: changeSummary || null,

    tags: [
      ...guideContData.subjects,

      ...guideContData.newSubjects
        .map((subject) => subject.id)
        .filter((id): id is string => !!id),
    ],

    newSubjects: guideContData.newSubjects
      .filter((subject) => !subject.id)
      .map((subject) => ({
        name: subject.name,
        summary: subject.summary || null,
      })),
  });

  // revent multiple simultaneous revision creations
  const creatingRef = useRef<Promise<string> | null>(null);

  /*
   * save the current revision
   * if a revision already exists - update it, otherwise create a new revision first
   */
  const persistDraft = async () => {
    if (revisionId) {
      await updateRevision(revisionId, draftFields());

      return revisionId;
    }

    if (!creatingRef.current) {
      creatingRef.current = createVariantRevision(variant.id)
        .then(async (id) => {
          setRevisionId(id);

          await updateRevision(id, draftFields());

          return id;
        })
        .finally(() => {
          creatingRef.current = null;
        });
    }

    return creatingRef.current;
  };

  /*
   * Upload an image against the current revision.
   */
  const uploadGuideImage = async (file: File) => {
    try {
      const id = revisionId ?? (await persistDraft());

      const { url } = await uploadMedia(file, id);

      return url;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not upload image"
      );

      throw error;
    }
  };

  // save current draft without submitting
  const saveDraft = async () => {
    setSubmitting(true);

    try {
      await persistDraft();

      await router.invalidate();

      toast.success("Draft saved");

      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save draft"
      );

      return false;
    } finally {
      setSubmitting(false);
    }
  };

  // submit revision for review
  const publish = async () => {
    setSubmitting(true);

    try {
      const fields = draftFields();

      // Prevent submitting a revision that contains no actual changes
      if (
        isRevisionDraftUnchanged(
          {
            title: snapshot.revision.title,
            summary: snapshot.revision.summary,
            body: snapshot.revision.body,
            change_summary: snapshot.revision.change_summary,
            subjectIds: snapshot.subjects.map((subject) => subject.id),
          },
          fields
        )
      ) {
        toast.error(
          "No changes made to the guide, make a change and try again."
        );

        return;
      }

      // a change summary is required for revisions
      if (fields.change_summary === null || fields.change_summary === "") {
        toast.error(
          "No changes summary provided, add a change summary and try again."
        );

        return;
      }

      const id = await persistDraft();

      await submitRevision(id);

      await router.invalidate();

      toast.success("Submitted for review");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[max(calc(100vh-65px),750px)] w-full max-w-[1280px] flex-col bg-background">
      <section className="relative flex min-h-0 flex-1 border-b px-8 py-8 lg:px-16">
        <Stepper.Root
          linear
          step={activeStep}
          onStepChange={setActiveStep}
          className="mx-auto flex min-h-0 w-full max-w-5xl min-w-0 flex-1 flex-col gap-8 pb-20 sm:pb-0"
        >
          {() => (
            <>
              <MobileStepProgress steps={editSteps} activeStep={activeStep} />

              <Stepper.List className="hidden w-full items-center justify-center text-sm sm:flex">
                <Stepper.Items>
                  {(step: any, index: number) => (
                    <Fragment key={step.id}>
                      {index > 0 && (
                        <ChevronRight className="mx-1 size-4 text-muted-foreground/50" />
                      )}

                      <Stepper.Item step={step.id}>
                        <Stepper.Trigger className="mono-micro flex items-center gap-2 rounded-full border border-border bg-background px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted data-[status=active]:border-primary data-[status=active]:bg-primary/10 data-[status=active]:text-primary data-[status=active]:ring-1 data-[status=active]:ring-primary/20">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                            {index + 1}
                          </span>
                          <Stepper.Title className="max-w-[20ch] truncate font-bold" />
                        </Stepper.Trigger>
                      </Stepper.Item>
                    </Fragment>
                  )}
                </Stepper.Items>
              </Stepper.List>

              <EditGuideInfo
                Stepper={Stepper}
                type="variant"
                guideContData={guideContData}
                onGuideChange={(update) =>
                  setGuideContData((previous) => ({
                    ...previous,
                    ...update,
                  }))
                }
                subjects={subjectOptions}
                guides={guideOptions}
                body={guideContData.body}
                onBodyChange={(body) =>
                  setGuideContData((previous) => ({
                    ...previous,
                    body,
                  }))
                }
                onUploadImage={uploadGuideImage}
                onSaveDraft={saveDraft}
                submitting={submitting}
                hideBackBtn
                changeSummary={changeSummary}
                onChangeSummaryChange={setChangeSummary}
              />

              <Submit
                Stepper={Stepper}
                guide={previewGuide}
                guideType={guideType}
                onSaveDraft={saveDraft}
                onPublish={publish}
                submitting={submitting}
                title="Preview"
                publishLabel="Submit Guide Revision"
              />
            </>
          )}
        </Stepper.Root>

        {draftId && <RejectionFeedback draftId={draftId} />}
      </section>
    </div>
  );
}
