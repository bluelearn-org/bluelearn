import { defineStepper } from "@stepperize/react";
import { ChevronRight } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
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
import { estimateReadMinutes, formatDate } from "@/lib/guideUtils";

import { SelectType } from "@/components/contribute/steps/SelectType";
import { GuideDetails } from "@/components/contribute/steps/GuideDetails";
import { VariantDetails } from "@/components/contribute/steps/VariantDetails";
import { Content } from "@/components/contribute/steps/Content";
import { ObjectiveDetails } from "@/components/contribute/steps/ObjectiveDetails";
import { Submit } from "@/components/contribute/steps/Submit";
import { OrderObjectiveGuides } from "@/components/contribute/steps/OrderObjectiveGuides";

import { flows, typeStep } from "@/lib/contributionFlow";

type PropTypes = {
  type: ContributionType | null;
  setType: (value: ContributionType) => void;
};

const createGuideContData = (): GuideContribution => ({
  type: "",
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
  targets: [
    "arithmetic-introduction",
    "algebra-how-to-express-equations",
    "calculus-introduction",
    "vectors-introduction",
    "mechanics-how-to-apply-newtons-laws",
  ],
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
    <Stepper.Root
      linear
      className="flex min-h-[calc(100vh_-_210px)] w-full flex-col gap-8"
    >
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

  // Draft revision id once it exists: null before the first save, so we know to
  // create vs. patch.
  const [revisionId, setRevisionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // subject/guide options are fetched once here and shared by the details step
  // (comboboxes) and the submit step (resolving slugs to names for the preview).
  const [subjectOptions, setSubjectOptions] = useState<
    Awaited<ReturnType<typeof listSubjects>>
  >([]);
  const [guideOptions, setGuideOptions] = useState<
    Awaited<ReturnType<typeof listGuides>>
  >([]);
  // author handle for the preview byline
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

  // shape the in-progress form as a HydratedGuide so the submit step can render
  // it with the same component the published page uses. slugs are resolved back
  // to names/titles from the fetched lists for the tag/prereq labels.
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

  // Create the guide on first save, patch it after. Returns the revision id.
  const persistDraft = async () => {
    if (revisionId) {
      await updateRevision(revisionId, draftFields());
      return revisionId;
    }

    const id = await createGuide({
      knowledge_type:
        guideContData.type === "practical" ? "practical" : "theoretical",
      ...draftFields(),
    });
    setRevisionId(id);
    return id;
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
    <div className="flex h-[calc(100vh-210px)] w-full flex-col gap-8">
      {/* horizontal breadcrumb stepper */}
      <Stepper.List className="flex w-full items-center justify-center text-sm">
        <Stepper.Items>
          {(step: any, index: number) => (
            <Fragment key={step.id}>
              {index > 0 && (
                <ChevronRight className="mx-1 size-4 text-muted-foreground/50" />
              )}

              <Stepper.Item step={step.id}>
                <Stepper.Trigger className="rounded-md p-2 font-mono text-[12px] text-muted-foreground uppercase transition-colors hover:bg-muted data-[status=active]:font-bold data-[status=active]:text-brand-blue data-[status=previous]:text-foreground">
                  <Stepper.Title />
                </Stepper.Trigger>
              </Stepper.Item>
            </Fragment>
          )}
        </Stepper.Items>
      </Stepper.List>

      {/* content */}
      <div className="flex min-w-0 flex-1 flex-col pb-24">
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

        <Content
          Stepper={Stepper}
          body={guideContData.body}
          onBodyChange={(body) =>
            setGuideContData((prev) => ({ ...prev, body }))
          }
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
