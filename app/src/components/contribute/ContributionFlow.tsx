import { defineStepper } from "@stepperize/react";
import { ChevronRight } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { Dispatch, SetStateAction } from "react";

import type {
  ContributionType,
  GuideContribution,
  ObjectiveContribution,
} from "@/types/contributions";
import type { GuideType, HydratedGuide } from "@/types/guides";
import { createGuide, listGuides } from "@/lib/api/guides";
import { getMyIdentity } from "@/lib/api/identity";
import { listSubjects } from "@/lib/api/subjects";
import { submitRevision, updateRevision } from "@/lib/api/guideRevisions";
import { uploadMedia } from "@/lib/api/media";
import { estimateReadMinutes, formatDate } from "@/lib/guideUtils";

import { SelectType } from "@/components/contribute/steps/SelectType";
import { GuideDetails } from "@/components/contribute/steps/GuideDetails";
import { VariantDetails } from "@/components/contribute/steps/VariantDetails";
import { Content } from "@/components/contribute/steps/Content";
import { ObjectiveDetails } from "@/components/contribute/steps/ObjectiveDetails";
import { Submit } from "@/components/contribute/steps/Submit";
import { OrderObjectiveGuides } from "@/components/contribute/steps/OrderObjectiveGuides";
import { OrderTargetGuides } from "@/components/contribute/steps/OrderTargetGuides";

import { flows, typeStep } from "@/lib/contributionFlow";

type PropTypes = {
  type: ContributionType | null;
  setType: (value: ContributionType) => void;
};

const createGuideContData = (): GuideContribution => ({
  type: "theoretical",
  title: "",
  summary: "",
  body: "",
  subjects: [],
  newSubjects: [],
  prereqs: [],
  todoPrereqs: [],
});

const createObjectiveContData = (): ObjectiveContribution => ({
  title: "",
  summary: "",
  targets: [],
  featured: "",
  subObjectives: [],
});

export default function ContributionFlow({ type, setType }: PropTypes) {
  const [guideContData, setGuideContData] =
    useState<GuideContribution>(createGuideContData);
  const [objectiveContData, setObjectiveContData] =
    useState<ObjectiveContribution>(createObjectiveContData);

  const StepperInstance = useMemo(() => {
    if (!type) {
      return defineStepper(typeStep);
    }

    return defineStepper([...typeStep, ...flows[type]]);
  }, [type]);

  const { Stepper } = StepperInstance;

  return (
    <Stepper.Root linear className="flex min-h-0 w-full flex-1 flex-col gap-8">
      {({ stepper }: any) => (
        <Inner
          Stepper={Stepper}
          stepper={stepper}
          type={type}
          setType={setType}
          guideContData={guideContData}
          setGuideContData={setGuideContData}
          objectiveContData={objectiveContData}
          setObjectiveContData={setObjectiveContData}
        />
      )}
    </Stepper.Root>
  );
}

function Inner({
  Stepper,
  stepper,
  type,
  setType,
  guideContData,
  setGuideContData,
  objectiveContData,
  setObjectiveContData,
}: {
  Stepper: any;
  stepper: any;
  type: ContributionType | null;
  setType: (value: ContributionType) => void;

  guideContData: GuideContribution;
  setGuideContData: Dispatch<SetStateAction<GuideContribution>>;

  objectiveContData: ObjectiveContribution;
  setObjectiveContData: Dispatch<SetStateAction<ObjectiveContribution>>;
}) {
  const pickType = (value: ContributionType) => {
    if (type !== value) {
      setGuideContData(createGuideContData());
      setObjectiveContData(createObjectiveContData());
      setType(value);
    }

    requestAnimationFrame(() => {
      switch (value) {
        case "guide":
          stepper.goTo("guide-details");
          break;

        case "variant":
          stepper.goTo("variant-details");
          break;

        default:
          stepper.goTo("objective-details");
      }
    });
  };

  const [revisionId, setRevisionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [subjectOptions, setSubjectOptions] = useState<
    Awaited<ReturnType<typeof listSubjects>>
  >([]);
  const [guideOptions, setGuideOptions] = useState<
    Awaited<ReturnType<typeof listGuides>>
  >([]);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const opts = { signal: controller.signal };

    listSubjects(opts)
      .then(setSubjectOptions)
      .catch(() => {});
    listGuides(opts)
      .then(setGuideOptions)
      .catch(() => {});
    getMyIdentity(opts)
      .then((data) => setUsername(data.profile.username))
      .catch(() => {});

    return () => controller.abort();
  }, []);

  // Shape the in-progress form as a HydratedGuide, so the submit step can render
  // it with the same component the published page uses.
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
      slug: "",
      title: guideContData.title || "Untitled guide",
      author: username ?? "You",
      summary: guideContData.summary,
      created_at: formatDate(new Date()),
      duration: estimateReadMinutes(guideContData.body),
      breadcrumbs: [],
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
  }, [guideContData, subjectOptions, guideOptions, username]);

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

  // Creates the draft first if needed, so the image has a revision to attach to.
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
    <div className="flex min-h-0 w-full flex-1 flex-col gap-6">
      {/* horizontal breadcrumb stepper */}
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

      {/* content */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <SelectType pickType={pickType} type={type} Stepper={Stepper} />

        <GuideDetails
          Stepper={Stepper}
          guideContData={guideContData}
          setGuideContData={setGuideContData}
          subjects={subjectOptions}
          guides={guideOptions}
          onSaveDraft={saveDraft}
          submitting={submitting}
        />

        <VariantDetails
          Stepper={Stepper}
          onSaveDraft={saveDraft}
          submitting={submitting}
        />

        <ObjectiveDetails
          Stepper={Stepper}
          objectiveContData={objectiveContData}
          setObjectiveContData={setObjectiveContData}
        />

        <OrderTargetGuides
          Stepper={Stepper}
          objectiveContData={objectiveContData}
          setObjectiveContData={setObjectiveContData}
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
        <OrderObjectiveGuides
          Stepper={Stepper}
          objectiveContData={objectiveContData}
          setObjectiveContData={setObjectiveContData}
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
    </div>
  );
}
