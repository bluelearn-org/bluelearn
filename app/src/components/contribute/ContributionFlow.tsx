import { defineStepper } from "@stepperize/react";
import { ChevronRight } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { Dispatch, SetStateAction } from "react";

import type {
  ContributionType,
  GuideContribution,
  ObjectiveContribution,
  VariantContribution,
} from "@/types/contributions";
import type { GuideType } from "@/types/guides";
import type { ReaderGuide } from "@/components/GuideReader";
import { addGuideVariant, createGuide, listGuides } from "@/lib/api/guides";
import { getMyIdentity } from "@/lib/api/identity";
import { listSubjects } from "@/lib/api/subjects";
import { createObjective, createObjectiveRevision } from "@/lib/api/objectives";
import {
  getObjectiveRevision,
  submitObjectiveRevision,
  updateObjectiveRevision,
} from "@/lib/api/objectiveRevisions";
import {
  getRevision,
  submitRevision,
  updateRevision,
} from "@/lib/api/guideRevisions";
import { uploadMedia } from "@/lib/api/media";
import { estimateReadMinutes, formatDate } from "@/lib/guideUtils";

import { SelectType } from "@/components/contribute/steps/SelectType";
import { GuideDetails } from "@/components/contribute/steps/GuideDetails";
import { VariantDetails } from "@/components/contribute/steps/VariantDetails";
import { Content } from "@/components/contribute/steps/Content";
import { ObjectiveDetails } from "@/components/contribute/steps/ObjectiveDetails";
import { PreviewGuide } from "@/components/contribute/steps/PreviewGuide";
import { OrderObjectiveGuides } from "@/components/contribute/steps/OrderObjectiveGuides";
import { OrderTargetGuides } from "@/components/contribute/steps/OrderTargetGuides";

import { flows, typeStep } from "@/lib/contributionFlow";
import { PreviewObjective } from "@/components/contribute/steps/PreviewObjective";
import { MobileStepProgress } from "@/components/contribute/MobileStepProgress";
import {
  clearStoredDraft,
  getStoredDraft,
  setStoredDraft,
  useDebouncedContributionSave,
} from "@/lib/contributionStorage";

const MAX_WORD_COUNT = 2500;

type PropTypes = {
  type: ContributionType | null;
  setType: (value: ContributionType) => void;
  step?: string;
  onStepChange?: (step: string) => void;
  onPublished?: () => void;
  draftId?: string;
  draftKind?: "guide" | "objective";
  sourceRevisionId?: string;
  editSlug?: string;
  todoTitle?: string;
  todoSummary?: string;
  todoIds: Array<string>;
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

const createVariantContData = (): VariantContribution => ({
  type: "",
  title: "",
  summary: "",
  baseGuide: "",
  subjects: [],
  newSubjects: [],
  body: "",
});

const createObjectiveContData = (): ObjectiveContribution => ({
  title: "",
  summary: "",
  changeSummary: "",
  targets: [],
  featuredSubObjective: "",
  subObjectives: [],
  subjects: [],
});

type ObjectiveRevisionData = Awaited<ReturnType<typeof getObjectiveRevision>>;

const objectiveDataFromRevision = (
  data: ObjectiveRevisionData
): ObjectiveContribution => {
  const slugByNodeId = new Map(data.snapshot.nodes.map((n) => [n.id, n.slug]));
  const targetNodes = data.snapshot.nodes
    .filter((n): n is typeof n & { slug: string } => n.is_target && !!n.slug)
    .sort((a, b) => (a.target_position ?? 0) - (b.target_position ?? 0));

  return {
    title: data.revision.title ?? "",
    summary: data.revision.summary ?? "",
    changeSummary: data.revision.change_summary ?? "",
    targets: targetNodes.map((n) => n.slug),
    featuredSubObjective: targetNodes.find((n) => n.is_featured)?.slug ?? "",
    subObjectives: targetNodes.flatMap((n) => {
      const sequence = data.snapshot.orders
        .filter((o) => o.target_node_id === n.id)
        .map((o) => slugByNodeId.get(o.node_id))
        .filter((slug): slug is string => !!slug);
      if (sequence.length === 0) return [];
      return [
        {
          targetSlug: n.slug,
          selectedSlugs: sequence,
          curatedSequence: sequence,
        },
      ];
    }),
    subjects: data.subjects.map((s) => s.id),
  };
};

type NewSubject = { id?: string; name: string; summary: string };

const existingTagIds = (newSubjects: Array<NewSubject>) =>
  newSubjects.map((s) => s.id).filter((id): id is string => !!id);

const unsavedSubjects = (newSubjects: Array<NewSubject>) =>
  newSubjects
    .filter((s) => !s.id)
    .map((s) => ({ name: s.name, summary: s.summary || null }));

export default function ContributionFlow({
  type,
  setType,
  step,
  onStepChange,
  onPublished,
  draftId,
  draftKind,
  sourceRevisionId,
  editSlug,
  todoTitle,
  todoSummary,
  todoIds,
}: PropTypes) {
  const [guideContData, setGuideContData] = useState<GuideContribution>(() => {
    if (draftId || todoTitle) return createGuideContData();
    const stored = getStoredDraft<GuideContribution>("guide");
    return stored?.data ?? createGuideContData();
  });
  const [variantContData, setVariantContData] = useState<VariantContribution>(
    () => {
      if (draftId) return createVariantContData();
      const stored = getStoredDraft<VariantContribution>("variant");
      return stored?.data ?? createVariantContData();
    }
  );
  const [objectiveContData, setObjectiveContData] =
    useState<ObjectiveContribution>(() => {
      if (draftId || editSlug) return createObjectiveContData();
      const stored = getStoredDraft<ObjectiveContribution>("objective");
      return stored?.data ?? createObjectiveContData();
    });

  const skipTypeStep = !!editSlug || !!draftId;

  const StepperInstance = useMemo(() => {
    if (!type) {
      return defineStepper(typeStep);
    }

    if (skipTypeStep) {
      return defineStepper(flows[type]);
    }

    return defineStepper([...typeStep, ...flows[type]]);
  }, [type, skipTypeStep]);

  const { Stepper } = StepperInstance;

  // Determine current active step from URL/props or fallback to initial step
  const activeStep = useMemo(() => {
    if (!type) return "type";
    return StepperInstance.parseStep(step) ?? flows[type][0].id;
  }, [type, step, StepperInstance]);

  useEffect(() => {
    if (!type || !step) return;
    if (!StepperInstance.parseStep(step)) onStepChange?.(activeStep);
  }, [type, step, StepperInstance, activeStep, onStepChange]);

  return (
    <Stepper.Root
      linear
      step={activeStep}
      onStepChange={(newStep: string) => {
        onStepChange?.(newStep);
      }}
      className="flex min-h-0 w-full flex-1 flex-col gap-8"
    >
      {({ stepper }: any) => (
        <Inner
          Stepper={Stepper}
          stepper={stepper}
          type={type}
          setType={setType}
          skipTypeStep={skipTypeStep}
          activeStep={activeStep}
          step={step}
          onPublished={onPublished}
          draftId={draftId}
          draftKind={draftKind}
          sourceRevisionId={sourceRevisionId}
          editSlug={editSlug}
          todoTitle={todoTitle}
          todoSummary={todoSummary}
          todoIds={todoIds}
          guideContData={guideContData}
          setGuideContData={setGuideContData}
          variantContData={variantContData}
          setVariantContData={setVariantContData}
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
  skipTypeStep,
  activeStep,
  step,
  onPublished,
  draftId,
  draftKind,
  sourceRevisionId,
  editSlug,
  todoTitle,
  todoSummary,
  todoIds,
  guideContData,
  setGuideContData,
  variantContData,
  setVariantContData,
  objectiveContData,
  setObjectiveContData,
}: {
  Stepper: any;
  stepper: any;
  type: ContributionType | null;
  setType: (value: ContributionType) => void;
  skipTypeStep: boolean;
  activeStep: string;
  step?: string;
  onPublished?: () => void;
  draftId?: string;
  draftKind?: "guide" | "objective";
  sourceRevisionId?: string;
  editSlug?: string;
  todoTitle?: string;
  todoSummary?: string;
  todoIds: Array<string>;

  guideContData: GuideContribution;
  setGuideContData: Dispatch<SetStateAction<GuideContribution>>;
  variantContData: VariantContribution;
  setVariantContData: Dispatch<SetStateAction<VariantContribution>>;

  objectiveContData: ObjectiveContribution;
  setObjectiveContData: Dispatch<SetStateAction<ObjectiveContribution>>;
}) {
  const pickType = (value: ContributionType) => {
    if (type !== value) {
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

  const [revisionId, setRevisionId] = useState<string | null>(() => {
    if (draftId) return draftId;
    if (!type || editSlug || todoTitle) return null;
    const stored = getStoredDraft<unknown>(type);
    return stored?.revisionId ?? null;
  });

  const [autosaveReady, setAutosaveReady] = useState(!draftId && !editSlug);

  useEffect(() => {
    if (draftId || editSlug || todoTitle) return;
    if (type) {
      const stored = getStoredDraft<unknown>(type);
      setRevisionId(stored?.revisionId ?? null);
    }
  }, [type, draftId, editSlug, todoTitle]);

  // Debounced auto-save for guide drafts
  const guideSave = useDebouncedContributionSave(
    autosaveReady && type === "guide" ? "guide" : null,
    guideContData,
    revisionId,
    step
  );

  // Debounced auto-save for variant drafts
  const variantSave = useDebouncedContributionSave(
    autosaveReady && type === "variant" ? "variant" : null,
    variantContData,
    revisionId,
    step
  );

  const objectiveSave = useDebouncedContributionSave(
    autosaveReady && type === "objective" ? "objective" : null,
    objectiveContData,
    revisionId,
    step
  );

  const [submitting, setSubmitting] = useState(false);
  const [publishAttempted, setPublishAttempted] = useState(false);
  const [showChangeSummary, setShowChangeSummary] = useState(false);
  const visibleSteps = !type
    ? typeStep
    : skipTypeStep
      ? flows[type]
      : [...typeStep, ...flows[type]];

  // Start from the todo page with the topic's title and summary already filled in.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!todoTitle || seededRef.current) return;
    seededRef.current = true;

    setGuideContData((prev) => ({
      ...prev,
      title: todoTitle,
      summary: todoSummary ?? prev.summary,
    }));
    setType("guide");
    requestAnimationFrame(() => stepper.goTo("guide-details"));
  }, [todoTitle, todoSummary]);

  // Resume a draft opened from the profile.
  const loadedDraftIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!draftId || loadedDraftIdRef.current === draftId) return;
    loadedDraftIdRef.current = draftId;

    if (draftKind === "objective") {
      getObjectiveRevision(draftId)
        .then((data) => {
          const objData = objectiveDataFromRevision(data);

          setObjectiveContData(objData);
          setShowChangeSummary(!!data.objective.current_revision_id);
          setStoredDraft("objective", {
            data: objData,
            revisionId: draftId,
            step: step ? step : "objective-details",
            updatedAt: Date.now(),
          });

          setRevisionId(draftId);
          setType("objective");
          setAutosaveReady(true);

          const targetStep =
            step && step !== "type" ? step : "objective-details";
          requestAnimationFrame(() => stepper.goTo(targetStep));
        })
        .catch(() => {
          setRevisionId(null);
          toast.error("Could not load draft");
        });
      return;
    }

    getRevision(draftId)
      .then((data) => {
        // A tag still awaiting approval is not pickable yet, so it resumes in
        // the new-subject list rather than the picker.
        const tagged = data.subjects
          .filter((s) => s.status === "published")
          .map((s) => s.id);
        const pending = data.subjects
          .filter((s) => s.status !== "published")
          .map((s) => ({ id: s.id, name: s.name, summary: s.summary ?? "" }));

        if (data.is_variant) {
          const vData: VariantContribution = {
            type: data.knowledge_type ?? "",
            title: data.revision.title ?? "",
            summary: data.revision.summary ?? "",
            body: data.revision.body ?? "",
            baseGuide: data.base_slug ?? "",
            subjects: tagged,
            newSubjects: pending,
          };
          setVariantContData(vData);
          setStoredDraft("variant", {
            data: vData,
            revisionId: draftId,
            step: step ? step : "variant-details",
            updatedAt: Date.now(),
          });
        } else {
          const gData: GuideContribution = {
            type: data.knowledge_type ?? "theoretical",
            title: data.revision.title ?? "",
            summary: data.revision.summary ?? "",
            body: data.revision.body ?? "",
            subjects: tagged,
            newSubjects: pending,
            prereqs: data.prerequisites,
            todoPrereqs: data.todos,
          };
          setGuideContData(gData);
          setStoredDraft("guide", {
            data: gData,
            revisionId: draftId,
            step: step ? step : "guide-details",
            updatedAt: Date.now(),
          });
        }
        setRevisionId(draftId);
        setType(data.is_variant ? "variant" : "guide");
        setAutosaveReady(true);
        requestAnimationFrame(() =>
          stepper.goTo(
            step ? step : data.is_variant ? "variant-details" : "guide-details"
          )
        );
      })
      .catch(() => {
        setRevisionId(null);
        toast.error("Could not load draft");
      });
  }, [draftId]);

  const seededSourceRef = useRef(false);
  useEffect(() => {
    if (!sourceRevisionId || !editSlug || seededSourceRef.current) return;
    seededSourceRef.current = true;

    getObjectiveRevision(sourceRevisionId)
      .then((data) => {
        setObjectiveContData({
          ...objectiveDataFromRevision(data),
          changeSummary: "",
        });
        setShowChangeSummary(!!data.objective.current_revision_id);
        setType("objective");
        requestAnimationFrame(() => stepper.goTo("objective-details"));
      })
      .catch(() => {
        toast.error("Could not load objective");
      });
  }, [sourceRevisionId, editSlug]);

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

  // Shape the in-progress form as a Guide, so the submit step can render it with
  // the same component the published page uses.
  const previewGuide: ReaderGuide = useMemo(() => {
    const nameById = new Map(
      subjectOptions.map((s) => [s.id, s.name] as const)
    );
    const titleBySlug = new Map(
      guideOptions
        .filter((g) => g.slug)
        .map((g) => [g.slug as string, g.title ?? (g.slug as string)] as const)
    );

    return {
      slug: "",
      variant_id: null,
      variant_slug: null,
      title: guideContData.title || "Untitled guide",
      author: username ?? "You",
      summary: guideContData.summary,
      body: guideContData.body,
      duration_minutes: estimateReadMinutes(guideContData.body),
      created_at: formatDate(new Date()),
      tags: [
        ...guideContData.subjects.map((id) => ({
          slug: id,
          name: nameById.get(id) ?? id,
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
    };
  }, [guideContData, subjectOptions, guideOptions, username]);

  const previewVariant: ReaderGuide = useMemo(() => {
    const nameById = new Map(
      subjectOptions.map((s) => [s.id, s.name] as const)
    );

    return {
      slug: "",
      variant_id: null,
      variant_slug: null,
      title: variantContData.title || "Untitled guide",
      author: username ?? "You",
      summary: variantContData.summary,
      body: variantContData.body,
      created_at: formatDate(new Date()),
      duration_minutes: estimateReadMinutes(variantContData.body),
      tags: [
        ...variantContData.subjects.map((id) => ({
          slug: id,
          name: nameById.get(id) ?? id,
        })),
        ...variantContData.newSubjects.map((s) => ({
          slug: s.name,
          name: s.name,
        })),
      ],
      prerequisites: [],
    };
  }, [variantContData, subjectOptions, username]);

  const guideType: GuideType | undefined =
    guideContData.type === "practical" || guideContData.type === "theoretical"
      ? guideContData.type
      : undefined;

  const draftFields = () => ({
    title: guideContData.title || null,
    summary: guideContData.summary || null,
    body: guideContData.body || null,
    tags: [
      ...guideContData.subjects,
      ...existingTagIds(guideContData.newSubjects),
    ],
    prerequisites: guideContData.prereqs,
    newSubjects: unsavedSubjects(guideContData.newSubjects),
    todoPrereqs: guideContData.todoPrereqs,
  });

  const variantDraftFields = () => ({
    title: variantContData.title || null,
    summary: variantContData.summary || null,
    body: variantContData.body || null,
    tags: [
      ...variantContData.subjects,
      ...existingTagIds(variantContData.newSubjects),
    ],
    newSubjects: unsavedSubjects(variantContData.newSubjects),
  });

  // The wizard tracks guides by slug; the API keys curation on guide base ids.
  const baseIdForSlug = (slug: string) => {
    const guide = guideOptions.find((g) => g.slug === slug);
    if (!guide) throw new Error(`Target guide not found: ${slug}`);
    return guide.id;
  };

  // Target order comes from the array, so this sends them in wizard order. A
  // target the curator has not sequenced yet goes without one, which leaves the
  // curation under it alone rather than emptying it.
  const objectiveTargets = () =>
    objectiveContData.targets.map((slug) => {
      const sub = objectiveContData.subObjectives.find(
        (s) => s.targetSlug === slug
      );
      return {
        guide_base_id: baseIdForSlug(slug),
        is_featured: objectiveContData.featuredSubObjective === slug,
        ...(sub ? { sequence: sub.curatedSequence.map(baseIdForSlug) } : {}),
      };
    });

  const creatingRef = useRef<Promise<string> | null>(null);
  const persistDraft = async () => {
    if (type === "objective") {
      const target_ids = objectiveContData.targets.map(baseIdForSlug);

      if (target_ids.length === 0) {
        throw new Error(
          "Learning objectives require at least one target guide."
        );
      }

      if (revisionId) {
        await updateObjectiveRevision(revisionId, {
          title: objectiveContData.title || undefined,
          summary: objectiveContData.summary || undefined,
          change_summary: objectiveContData.changeSummary || null,
          tags: objectiveContData.subjects,
          targets: objectiveTargets(),
        });
        return revisionId;
      }

      if (editSlug) {
        if (!creatingRef.current) {
          creatingRef.current = createObjectiveRevision(editSlug)
            .then(async (id) => {
              await updateObjectiveRevision(id, {
                title: objectiveContData.title || undefined,
                summary: objectiveContData.summary || undefined,
                change_summary: objectiveContData.changeSummary || null,
                tags: objectiveContData.subjects,
                targets: objectiveTargets(),
              });
              setRevisionId(id);
              return id;
            })
            .finally(() => {
              creatingRef.current = null;
            });
        }
        return creatingRef.current;
      }

      if (!creatingRef.current) {
        creatingRef.current = createObjective({
          title: objectiveContData.title || undefined,
          summary: objectiveContData.summary || undefined,
          target_ids,
          tags: objectiveContData.subjects,
        })
          .then(async (id) => {
            // Creation only seeds the closure, so the curation has to update
            // before publish.
            await updateObjectiveRevision(id, { targets: objectiveTargets() });
            setRevisionId(id);
            return id;
          })
          .finally(() => {
            creatingRef.current = null;
          });
      }
      return creatingRef.current;
    }

    if (revisionId) {
      await updateRevision(
        revisionId,
        type === "guide" ? draftFields() : variantDraftFields()
      );
      return revisionId;
    }

    if (type === "variant" && !variantContData.baseGuide) {
      throw new Error("Pick a base guide before saving");
    }

    if (!creatingRef.current) {
      creatingRef.current = (
        type === "guide"
          ? createGuide({
              knowledge_type:
                guideContData.type === "practical"
                  ? "practical"
                  : "theoretical",
              ...draftFields(),
              todoClaims: todoIds,
            })
          : addGuideVariant(variantContData.baseGuide, variantDraftFields())
      )
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
      if (!id) throw new Error("Failed to save draft before uploading image");
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
      const id = await persistDraft();
      if (type && !editSlug) {
        const currentData =
          type === "guide"
            ? guideContData
            : type === "variant"
              ? variantContData
              : objectiveContData;
        setStoredDraft(type, {
          data: currentData,
          revisionId: id,
          step,
          updatedAt: Date.now(),
        });
      }
      toast.success("Draft saved");
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save draft");
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const missingObjectiveFields = () => {
    const missing: Array<{ field: string; label: string }> = [];
    if (!objectiveContData.title.trim())
      missing.push({ field: "title", label: "a title" });
    if (!objectiveContData.summary.trim())
      missing.push({ field: "summary", label: "a summary" });
    if (showChangeSummary && !objectiveContData.changeSummary.trim())
      missing.push({ field: "changeSummary", label: "a change summary" });
    if (objectiveContData.subjects.length === 0)
      missing.push({ field: "subjects", label: "a subject" });
    if (objectiveContData.targets.length === 0)
      missing.push({ field: "targets", label: "a target guide" });
    else if (!objectiveContData.featuredSubObjective)
      missing.push({
        field: "featuredSubObjective",
        label: "a featured sub-objective",
      });
    return missing;
  };

  const invalidObjectiveFields = publishAttempted
    ? new Set(missingObjectiveFields().map((m) => m.field))
    : undefined;

  const publish = async () => {
    setSubmitting(true);
    try {
      if (type === "guide") {
        const text = guideContData.body.trim();
        const wordCount = text ? text.split(/\s+/).length : 0;

        if (wordCount > MAX_WORD_COUNT) {
          toast.error("Word count limit exceeded", {
            description: `Your guide currently has ${wordCount.toLocaleString()} words. Please reduce it to ${MAX_WORD_COUNT.toLocaleString()} words or fewer.`,
          });
          return;
        }
      }

      if (type === "objective") {
        const missing = missingObjectiveFields();
        if (missing.length > 0) {
          setPublishAttempted(true);
          stepper.goTo("objective-details");
          throw new Error(
            `Your objective is missing ${missing.map((m) => m.label).join(", ")}`
          );
        }
        setPublishAttempted(false);
      }

      const id = await persistDraft();
      if (!id) throw new Error("Failed to save draft before publishing");
      if (type === "objective") {
        await submitObjectiveRevision(id);
        objectiveSave.cancel();
        if (!editSlug) clearStoredDraft("objective");
        setObjectiveContData(createObjectiveContData());
        setRevisionId(null);
        onPublished?.();
        toast.success("Objective published");
      } else if (type) {
        await submitRevision(id);
        if (type === "guide") {
          guideSave.cancel();
          clearStoredDraft("guide");
          setGuideContData(createGuideContData());
        } else {
          variantSave.cancel();
          clearStoredDraft("variant");
          setVariantContData(createVariantContData());
        }
        setRevisionId(null);
        onPublished?.();
        toast.success("Submitted for review");
      }
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : type === "objective"
            ? "Could not publish"
            : "Could not submit"
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (skipTypeStep && !type) return null;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-6 pb-20 sm:pb-0">
      <MobileStepProgress steps={visibleSteps} activeStep={activeStep} />

      {/* horizontal breadcrumb stepper */}
      <Stepper.List className="hidden w-full items-center justify-center text-sm sm:flex">
        <Stepper.Items>
          {(item: any, index: number) => (
            <Fragment key={item.id}>
              {index > 0 && (
                <ChevronRight className="mx-1 size-4 shrink-0 text-muted-foreground/50" />
              )}

              <Stepper.Item step={item.id}>
                <Stepper.Trigger className="mono-micro flex shrink-0 items-center gap-2 rounded-full border border-border bg-background px-2 py-2 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted data-[status=active]:border-primary data-[status=active]:bg-primary/10 data-[status=active]:text-primary data-[status=active]:ring-1 data-[status=active]:ring-primary/20">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
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
        {!skipTypeStep && (
          <SelectType pickType={pickType} type={type} Stepper={Stepper} />
        )}

        <GuideDetails
          Stepper={Stepper}
          type={type}
          guideContData={guideContData}
          setGuideContData={setGuideContData}
          subjects={subjectOptions}
          guides={guideOptions}
          hideBackBtn={skipTypeStep}
          onSaveDraft={saveDraft}
          submitting={submitting}
        />

        <VariantDetails
          Stepper={Stepper}
          type={type}
          variantContData={variantContData}
          setVariantContData={setVariantContData}
          guides={guideOptions}
          subjects={subjectOptions}
          hideBackBtn={skipTypeStep}
          onSaveDraft={saveDraft}
          submitting={submitting}
        />

        <ObjectiveDetails
          Stepper={Stepper}
          objectiveContData={objectiveContData}
          setObjectiveContData={setObjectiveContData}
          subjects={subjectOptions}
          guides={guideOptions}
          showChangeSummary={showChangeSummary}
          invalidFields={invalidObjectiveFields}
          hideBackBtn={skipTypeStep}
          onSaveDraft={saveDraft}
          submitting={submitting}
        />

        <OrderTargetGuides
          Stepper={Stepper}
          objectiveContData={objectiveContData}
          setObjectiveContData={setObjectiveContData}
          onSaveDraft={saveDraft}
          submitting={submitting}
          guides={guideOptions}
        />

        <Content
          Stepper={Stepper}
          type={type}
          body={type == "guide" ? guideContData.body : variantContData.body}
          onBodyChange={(body) => {
            if (type == "guide") {
              setGuideContData((prev) => ({ ...prev, body }));
            } else {
              setVariantContData((prev) => ({ ...prev, body }));
            }
          }}
          onUploadImage={uploadGuideImage}
          onSaveDraft={saveDraft}
          submitting={submitting}
        />
        <OrderObjectiveGuides
          Stepper={Stepper}
          objectiveContData={objectiveContData}
          setObjectiveContData={setObjectiveContData}
          onSaveDraft={saveDraft}
          submitting={submitting}
          guides={guideOptions}
        />

        <PreviewGuide
          Stepper={Stepper}
          type={type}
          guide={type === "guide" ? previewGuide : previewVariant}
          guideType={type === "guide" ? guideType : undefined}
          onSaveDraft={saveDraft}
          onPublish={publish}
          submitting={submitting}
        />

        <PreviewObjective
          Stepper={Stepper}
          objectiveContData={objectiveContData}
          onSaveDraft={saveDraft}
          onPublish={publish}
          submitting={submitting}
          guideOptions={guideOptions}
          subjectOptions={subjectOptions}
        />
      </div>
    </div>
  );
}
