import { defineStepper } from "@stepperize/react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { GuideContribution } from "@/types/contributions";
import type { GuideType, HydratedGuide } from "@/types/guides";
import { createGuide, listGuides } from "@/lib/api/guides";
import { getMyIdentity } from "@/lib/api/identity";
import { listSubjects } from "@/lib/api/subjects";
import { submitRevision, updateRevision } from "@/lib/api/guideRevisions";
import { uploadMedia } from "@/lib/api/media";
import { estimateReadMinutes } from "@/lib/guideUtils";
import { getGuideBySlug } from "@/lib/getData";

import guidesData from "@/data/guides.json";
import subjectsData from "@/data/subjects.json";

import { GuideDetails } from "@/components/contribute/steps/GuideDetails";
import { Content } from "@/components/contribute/steps/Content";
import { Submit } from "@/components/contribute/steps/Submit";

export const Route = createFileRoute("/edit/guide/$slug")({
  loader: ({ params }) => {
    const guide = getGuideBySlug(guidesData, params.slug);
    if (!guide) {
      throw notFound();
    }
    return { guide };
  },
  component: RouteComponent,
});

const StepperInstance = defineStepper([
  { id: "guide-details", title: "Guide Details" },
  { id: "content", title: "Content" },
  { id: "submit", title: "Preview" },
]);

function RouteComponent() {
  const { guide: initialGuide } = Route.useLoaderData();
  const { Stepper } = StepperInstance;

  const [guideContData, setGuideContData] = useState<GuideContribution>(() => ({
    type: initialGuide.level ? "practical" : "theoretical",
    title: initialGuide.title,
    summary: initialGuide.summary,
    body: initialGuide.content,
    subjects: initialGuide.tags,
    newSubjects: [],
    prereqs: initialGuide.prerequisites,
    todoPrereqs: [],
  }));

  const [revisionId, setRevisionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [subjectOptions, setSubjectOptions] =
    useState<Array<{ slug: string; name: string }>>(subjectsData);

  const [guideOptions, setGuideOptions] = useState<
    Array<{
      slug: string | null;
      title: string | null;
      summary: string | null;
    }>
  >(guidesData);

  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const opts = { signal: controller.signal };

    listSubjects(opts)
      .then((data) => {
        if (data.length > 0) setSubjectOptions(data);
      })
      .catch(() => {});
    listGuides(opts)
      .then((data) => {
        if (data.length > 0) setGuideOptions(data);
      })
      .catch(() => {});
    getMyIdentity(opts)
      .then((data) => setUsername(data.profile.username))
      .catch(() => {});

    return () => controller.abort();
  }, []);

  const previewGuide: HydratedGuide = useMemo(() => {
    const nameBySlug = new Map(
      subjectOptions.map((s) => [s.slug, s.name] as const)
    );
    const titleBySlug = new Map(
      guideOptions
        .filter((g) => g.slug)
        .map((g) => [g.slug as string, g.title ?? (g.slug as string)] as const)
    );

    return {
      slug: initialGuide.slug,
      title: guideContData.title || "Untitled guide",
      author: username ?? initialGuide.author,
      summary: guideContData.summary,
      created_at: initialGuide.created_at,
      duration: estimateReadMinutes(guideContData.body),
      breadcrumbs: initialGuide.breadcrumbs,
      tags: [
        ...guideContData.subjects.map((slug) => ({
          slug,
          name: nameBySlug.get(slug) ?? slug,
        })),
        ...guideContData.newSubjects.map((s) => ({
          slug: s.name,
          name: s.name,
        })),
      ],
      prerequisites: guideContData.prereqs.map((slug) => ({
        slug,
        title: titleBySlug.get(slug) ?? slug,
      })),
      content: guideContData.body,
    };
  }, [guideContData, subjectOptions, guideOptions, username, initialGuide]);

  const guideType: GuideType | undefined =
    guideContData.type === "practical" || guideContData.type === "theoretical"
      ? guideContData.type
      : undefined;

  const draftFields = () => ({
    title: guideContData.title || null,
    summary: guideContData.summary || null,
    body: guideContData.body || null,
    tags: guideContData.subjects,
    prerequisites: guideContData.prereqs,
    newSubjects: guideContData.newSubjects.map((s) => ({
      name: s.name,
      summary: s.summary || null,
    })),
    todoPrereqs: guideContData.todoPrereqs,
  });

  const creatingRef = useRef<Promise<string> | null>(null);

  const persistDraft = async () => {
    if (revisionId) {
      await updateRevision(revisionId, draftFields());
      return revisionId;
    }

    if (!creatingRef.current) {
      creatingRef.current = createGuide({
        knowledge_type:
          guideContData.type === "practical" ? "practical" : "theoretical",
        ...draftFields(),
      })
        .then((id) => {
          setRevisionId(id);
          return id;
        })
        .finally(() => {
          creatingRef.current = null;
        });
    }
    return creatingRef.current;
  };

  const uploadGuideImage = async (file: File) => {
    try {
      const id = revisionId ?? (await persistDraft());
      const { url } = await uploadMedia(file, id);
      return url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload image");
      throw e;
    }
  };

  const saveDraft = async () => {
    setSubmitting(true);
    try {
      await persistDraft();
      toast.success("Draft saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save draft");
    } finally {
      setSubmitting(false);
    }
  };

  const publish = async () => {
    setSubmitting(true);
    try {
      const id = await persistDraft();
      await submitRevision(id);
      toast.success("Submitted for review");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[max(calc(100vh-65px),750px)] w-full max-w-[1280px] flex-col border-x bg-background">
      <section className="flex min-h-0 flex-1 flex-col border-b px-8 py-8 lg:px-16">
        <Stepper.Root
          linear
          className="flex min-h-0 w-full flex-1 flex-col gap-8"
        >
          {() => (
            <>
              <Stepper.List className="flex w-full items-center justify-center text-sm">
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

              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <GuideDetails
                  Stepper={Stepper}
                  guideContData={guideContData}
                  setGuideContData={setGuideContData}
                  subjects={subjectOptions}
                  guides={guideOptions}
                  onSaveDraft={saveDraft}
                  submitting={submitting}
                />

                <Content
                  Stepper={Stepper}
                  body={guideContData.body}
                  onBodyChange={(body) =>
                    setGuideContData((prev) => ({ ...prev, body }))
                  }
                  onUploadImage={uploadGuideImage}
                  onSaveDraft={saveDraft}
                  submitting={submitting}
                />

                <Submit
                  Stepper={Stepper}
                  guide={previewGuide}
                  guideType={guideType}
                  onSaveDraft={saveDraft}
                  onPublish={publish}
                  submitting={submitting}
                />
              </div>
            </>
          )}
        </Stepper.Root>
      </section>
    </div>
  );
}
