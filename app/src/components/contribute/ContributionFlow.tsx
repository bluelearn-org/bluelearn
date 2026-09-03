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

import { MobileStepProgress } from "@/components/contribute/MobileStepProgress";

import { SelectType } from "@/components/contribute/steps/SelectType";
import { GuideInfo } from "@/components/contribute/steps/guide/GuideInfo";
import { PreviewGuide } from "@/components/contribute/steps/guide/PreviewGuide";

import { VariantInfo } from "@/components/contribute/steps/variant/VariantInfo";
import { PreviewVariant } from "@/components/contribute/steps/variant/PreviewVariant";

import { ObjectiveDetails } from "@/components/contribute/steps/objective/ObjectiveDetails";
import { OrderObjectiveGuides } from "@/components/contribute/steps/objective/OrderObjectiveGuides";
import { OrderTargetGuides } from "@/components/contribute/steps/objective/OrderTargetGuides";
import { PreviewObjective } from "@/components/contribute/steps/objective/PreviewObjective";

import { addGuideVariant, createGuide, listGuides } from "@/lib/api/guides";
import { getMyIdentity } from "@/lib/api/identity";
import { listSubjects } from "@/lib/api/subjects";
import { flows, typeStep } from "@/lib/contributionFlow";
import { uploadMedia } from "@/lib/api/media";
import {
  getRevision,
  submitRevision,
  updateRevision,
} from "@/lib/api/guideRevisions";
import { createObjective, createObjectiveRevision } from "@/lib/api/objectives";
import {
  getObjectiveRevision,
  submitObjectiveRevision,
  updateObjectiveRevision,
} from "@/lib/api/objectiveRevisions";

import {
  clearStoredDraft,
  createLocalDraftId,
  getStoredDraftsByType,
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

type MultiGuide = GuideContribution & {
  localDraftId: string;
  revisionId: string | null;
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

const createMultiGuide = (): MultiGuide => ({
  localDraftId: createLocalDraftId(),
  revisionId: null,
  ...createGuideContData(),
});

const createVariantContData = (): VariantContribution => ({
  type: "theoretical",
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

      if (sequence.length === 0) {
        return [];
      }

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

type NewSubject = {
  id?: string;
  name: string;
  summary: string;
};

const existingTagIds = (newSubjects: Array<NewSubject>) =>
  newSubjects.map((s) => s.id).filter((id): id is string => !!id);

const unsavedSubjects = (newSubjects: Array<NewSubject>) =>
  newSubjects
    .filter((s) => !s.id)
    .map((s) => ({
      name: s.name,
      summary: s.summary || null,
    }));

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
  const [guideContData, setGuideContData] = useState<Array<MultiGuide>>(() => {
    if (draftId || todoTitle) {
      return [createMultiGuide()];
    }

    const storedGuides = getStoredDraftsByType("guide");

    if (storedGuides.length > 0) {
      return storedGuides.map((draft) => ({
        localDraftId: draft.localDraftId,
        revisionId: draft.revisionId,
        ...draft.data,
      }));
    }

    return [createMultiGuide()];
  });

  const [activeGuideId, setActiveGuideId] = useState<string>(
    () => guideContData[0]?.localDraftId ?? ""
  );

  const [variantLocalDraftId] = useState<string>(() => createLocalDraftId());

  const [variantContData, setVariantContData] = useState<VariantContribution>(
    () => {
      if (draftId) {
        return createVariantContData();
      }

      const storedVariants = getStoredDraftsByType("variant");

      return storedVariants[0]?.data ?? createVariantContData();
    }
  );

  const [objectiveLocalDraftId] = useState<string>(() => createLocalDraftId());

  const [objectiveContData, setObjectiveContData] =
    useState<ObjectiveContribution>(() => {
      if (draftId || editSlug) {
        return createObjectiveContData();
      }

      const storedObjectives = getStoredDraftsByType("objective");

      return storedObjectives[0]?.data ?? createObjectiveContData();
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

  const initialStep = useMemo(() => {
    if (!type) {
      return "type";
    }

    return StepperInstance.parseStep(step) ?? flows[type][0].id;
  }, [type, step, StepperInstance]);

  const [currentStep, setCurrentStep] = useState<string>(initialStep);

  useEffect(() => {
    setCurrentStep(initialStep);
  }, [initialStep]);

  return (
    <Stepper.Root
      linear
      step={currentStep}
      onStepChange={(newStep: string) => {
        setCurrentStep(newStep);
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
          activeStep={currentStep}
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
          activeGuideId={activeGuideId}
          setActiveGuideId={setActiveGuideId}
          variantLocalDraftId={variantLocalDraftId}
          variantContData={variantContData}
          setVariantContData={setVariantContData}
          objectiveLocalDraftId={objectiveLocalDraftId}
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
  activeGuideId,
  setActiveGuideId,
  guideContData,
  setGuideContData,
  variantLocalDraftId,
  variantContData,
  setVariantContData,
  objectiveLocalDraftId,
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

  activeGuideId: string;
  setActiveGuideId: Dispatch<SetStateAction<string>>;

  guideContData: Array<MultiGuide>;
  setGuideContData: Dispatch<SetStateAction<Array<MultiGuide>>>;

  variantLocalDraftId: string;
  variantContData: VariantContribution;
  setVariantContData: Dispatch<SetStateAction<VariantContribution>>;

  objectiveLocalDraftId: string;
  objectiveContData: ObjectiveContribution;
  setObjectiveContData: Dispatch<SetStateAction<ObjectiveContribution>>;
}) {
  const activeGuide: MultiGuide = useMemo(() => {
    const foundGuide = guideContData.find(
      (guide) => guide.localDraftId === activeGuideId
    );

    if (foundGuide) {
      return foundGuide;
    }

    return guideContData[0] ?? createMultiGuide();
  }, [guideContData, activeGuideId]);

  const updateActiveGuide = (update: Partial<MultiGuide>) => {
    setGuideContData((prev) =>
      prev.map((guide) =>
        guide.localDraftId === activeGuide.localDraftId
          ? { ...guide, ...update }
          : guide
      )
    );
  };

  const addGuide = () => {
    const newGuide = createMultiGuide();
    setGuideContData((prev) => [...prev, newGuide]);
    setActiveGuideId(newGuide.localDraftId);
    setType("guide");
  };

  // remove one local guide from state (workspace) and localstorage - NOT from server
  const removeGuide = (id: string) => {
    if (guideContData.length <= 1) {
      return;
    }

    clearStoredDraft(id);

    setGuideContData((prev) =>
      prev.filter((guide) => guide.localDraftId !== id)
    );

    if (activeGuideId === id) {
      const remaining = guideContData.filter(
        (guide) => guide.localDraftId !== id
      );
      setActiveGuideId(remaining[0]?.localDraftId ?? "");
    }
  };

  const updateActiveVariant = (update: Partial<VariantContribution>) => {
    setVariantContData((prev) => ({
      ...prev,
      ...update,
    }));
  };

  const pickType = (value: ContributionType) => {
    if (type === value) {
      return;
    }

    setType(value);

    const firstStep = flows[value][0].id;
    requestAnimationFrame(() => stepper.goTo(firstStep));
  };

  // revisionId fetched to the database - stored on EACH guide draft
  const [revisionId, setRevisionId] = useState<string | null>(() => {
    if (draftId) {
      return draftId;
    }
    return null;
  });

  const [autosaveReady, setAutosaveReady] = useState(!draftId && !editSlug);

  const guideSave = useDebouncedContributionSave(
    autosaveReady && type === "guide" ? activeGuide.localDraftId : null,
    autosaveReady && type === "guide" ? "guide" : null,
    {
      type: activeGuide.type,
      title: activeGuide.title,
      summary: activeGuide.summary,
      body: activeGuide.body,
      subjects: activeGuide.subjects,
      newSubjects: activeGuide.newSubjects,
      prereqs: activeGuide.prereqs,
      todoPrereqs: activeGuide.todoPrereqs,
    },
    activeGuide.revisionId,
    step
  );

  const variantSave = useDebouncedContributionSave(
    autosaveReady && type === "variant" ? variantLocalDraftId : null,
    autosaveReady && type === "variant" ? "variant" : null,
    variantContData,
    revisionId,
    step
  );

  const objectiveSave = useDebouncedContributionSave(
    autosaveReady && type === "objective" ? objectiveLocalDraftId : null,
    autosaveReady && type === "objective" ? "objective" : null,
    objectiveContData,
    revisionId,
    step
  );

  const [submitting, setSubmitting] = useState(false);

  const [publishAttempted, setPublishAttempted] = useState(false);

  const [showChangeSummary, setShowChangeSummary] = useState(false);

  const storeContributionDraft = (
    draftType: ContributionType,
    data: GuideContribution | VariantContribution | ObjectiveContribution,
    localDraftId: string,
    serverRevisionId: string | null,
    draftStep?: string
  ) => {
    setStoredDraft({
      localDraftId,
      type: draftType,
      data,
      revisionId: serverRevisionId,
      step: draftStep,
      updatedAt: Date.now(),
    } as never);
  };

  const visibleSteps = useMemo(() => {
    if (!type) {
      return typeStep;
    }

    if (skipTypeStep) {
      return flows[type];
    }

    return [...typeStep, ...flows[type]];
  }, [type, skipTypeStep]);

  // seeding
  const seededRef = useRef(false);

  useEffect(() => {
    if (!todoTitle || seededRef.current) {
      return;
    }

    seededRef.current = true;

    setGuideContData((prev) =>
      prev.map((guide) =>
        guide.localDraftId === activeGuideId
          ? {
              ...guide,
              title: todoTitle,
              summary: todoSummary ?? guide.summary,
            }
          : guide
      )
    );

    setType("guide");
  }, [todoTitle, todoSummary, activeGuideId, setType]);

  useEffect(() => {
    if (!todoTitle || !seededRef.current || type !== "guide") {
      return;
    }

    const frame = requestAnimationFrame(() => {
      stepper.goTo("guide-info");
    });

    return () => cancelAnimationFrame(frame);
  }, [todoTitle, type, stepper]);

  // resume server draft
  const loadedDraftIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!draftId || loadedDraftIdRef.current === draftId) {
      return;
    }
    loadedDraftIdRef.current = draftId;

    if (draftKind === "objective") {
      getObjectiveRevision(draftId)
        .then((data) => {
          const objData = objectiveDataFromRevision(data);
          setObjectiveContData(objData);
          setShowChangeSummary(!!data.objective.current_revision_id);

          storeContributionDraft(
            "objective",
            objData,
            objectiveLocalDraftId,
            draftId,
            step ?? "objective-details"
          );

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
        const tagged = data.subjects
          .filter((s) => s.status === "published")
          .map((s) => s.id);

        const pending = data.subjects
          .filter((s) => s.status !== "published")
          .map((s) => ({ id: s.id, name: s.name, summary: s.summary ?? "" }));

        if (data.is_variant) {
          const knowledgeType =
            data.knowledge_type === "theoretical" ||
            data.knowledge_type === "practical"
              ? data.knowledge_type
              : "theoretical";
          const vData: VariantContribution = {
            type: knowledgeType,
            title: data.revision.title ?? "",
            summary: data.revision.summary ?? "",
            body: data.revision.body ?? "",
            baseGuide: data.base_slug ?? "",
            subjects: tagged,
            newSubjects: pending,
          };

          setVariantContData(vData);

          storeContributionDraft(
            "variant",
            vData,
            variantLocalDraftId,
            draftId,
            step ?? "variant-info"
          );
        } else {
          const gData: MultiGuide = {
            localDraftId: createLocalDraftId(),
            revisionId: draftId,
            type: data.knowledge_type ?? "theoretical",
            title: data.revision.title ?? "",
            summary: data.revision.summary ?? "",
            body: data.revision.body ?? "",
            subjects: tagged,
            newSubjects: pending,
            prereqs: data.prerequisites,
            todoPrereqs: data.todos,
          };

          setGuideContData([gData]);

          setActiveGuideId(gData.localDraftId);

          storeContributionDraft(
            "guide",
            {
              type: gData.type,
              title: gData.title,
              summary: gData.summary,
              body: gData.body,
              subjects: gData.subjects,
              newSubjects: gData.newSubjects,
              prereqs: gData.prereqs,
              todoPrereqs: gData.todoPrereqs,
            },
            gData.localDraftId,
            draftId,
            step ?? "guide-info"
          );
        }

        setRevisionId(draftId);

        setType(data.is_variant ? "variant" : "guide");

        setAutosaveReady(true);

        requestAnimationFrame(() =>
          stepper.goTo(
            step ?? (data.is_variant ? "variant-details" : "guide-info")
          )
        );
      })
      .catch(() => {
        setRevisionId(null);
        toast.error("Could not load draft");
      });
  }, [
    draftId,
    draftKind,
    objectiveLocalDraftId,
    variantLocalDraftId,
    step,
    stepper,
    setType,
  ]);

  // objective source revision
  const seededSourceRef = useRef(false);

  useEffect(() => {
    if (!sourceRevisionId || !editSlug || seededSourceRef.current) {
      return;
    }

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
  }, [sourceRevisionId, editSlug, stepper]);

  const [subjectOptions, setSubjectOptions] = useState<
    Awaited<ReturnType<typeof listSubjects>>
  >([]);
  const [guideOptions, setGuideOptions] = useState<
    Awaited<ReturnType<typeof listGuides>>
  >([]);

  useEffect(() => {
    const controller = new AbortController();
    const opts = { signal: controller.signal };

    listSubjects(opts)
      .then(setSubjectOptions)
      .catch(() => {});

    listGuides(opts)
      .then(setGuideOptions)
      .catch(() => {});

    return () => controller.abort();
  }, []);

  // server draft payload
  const draftFields = () => {
    return {
      title: activeGuide.title || null,
      summary: activeGuide.summary || null,
      body: activeGuide.body || null,
      tags: [
        ...activeGuide.subjects,
        ...existingTagIds(activeGuide.newSubjects),
      ],
      prerequisites: activeGuide.prereqs,
      newSubjects: unsavedSubjects(activeGuide.newSubjects),
      todoPrereqs: activeGuide.todoPrereqs,
    };
  };

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

  const baseIdForSlug = (slug: string) => {
    const guide = guideOptions.find((g) => g.slug === slug);

    if (!guide) {
      throw new Error(`Target guide not found: ${slug}`);
    }

    return guide.id;
  };

  const objectiveTargets = () =>
    objectiveContData.targets.map((slug) => {
      const sub = objectiveContData.subObjectives.find(
        (s) => s.targetSlug === slug
      );

      return {
        guide_base_id: baseIdForSlug(slug),
        is_featured: objectiveContData.featuredSubObjective === slug,
        ...(sub
          ? {
              sequence: sub.curatedSequence.map(baseIdForSlug),
            }
          : {}),
      };
    });

  // prevent two simultaneous create requests
  const creatingRef = useRef<Promise<string> | null>(null);

  // server persistence - guide revisionId lives on the active guide itself
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

    // Guide/Variant
    if (type === "guide") {
      // active guide owns its own server revisionId.
      if (activeGuide.revisionId) {
        await updateRevision(activeGuide.revisionId, draftFields());

        return activeGuide.revisionId;
      }

      const newRevisionId = await createGuide({
        knowledge_type:
          activeGuide.type === "practical" ? "practical" : "theoretical",
        ...draftFields(),
        todoClaims: todoIds,
      });

      // store the server revision ID on THIS guide only
      setGuideContData((prev) =>
        prev.map((guide) =>
          guide.localDraftId === activeGuide.localDraftId
            ? { ...guide, revisionId: newRevisionId }
            : guide
        )
      );

      return newRevisionId;
    }

    // variant
    if (revisionId) {
      await updateRevision(revisionId, variantDraftFields());
      return revisionId;
    }

    if (!variantContData.baseGuide) {
      throw new Error("Pick a base guide before saving");
    }

    if (!creatingRef.current) {
      creatingRef.current = addGuideVariant(
        variantContData.baseGuide,
        variantDraftFields()
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

  // image upload
  const uploadGuideImage = async (file: File) => {
    try {
      const id =
        type === "guide"
          ? (activeGuide.revisionId ?? (await persistDraft()))
          : (revisionId ?? (await persistDraft()));

      if (!id) {
        throw new Error("Failed to save draft before uploading image");
      }

      const { url } = await uploadMedia(file, id);

      return url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload image");
      throw e;
    }
  };

  // manual save
  const saveDraft = async () => {
    setSubmitting(true);

    try {
      const id = await persistDraft();

      // keep localStorage in sync with the server revision ID
      if (type === "guide") {
        storeContributionDraft(
          "guide",
          {
            type: activeGuide.type,
            title: activeGuide.title,
            summary: activeGuide.summary,
            body: activeGuide.body,
            subjects: activeGuide.subjects,
            newSubjects: activeGuide.newSubjects,
            prereqs: activeGuide.prereqs,
            todoPrereqs: activeGuide.todoPrereqs,
          },
          activeGuide.localDraftId,
          id,
          step
        );

        // update guide in state so revisionId is available
        if (id && id !== activeGuide.revisionId) {
          setGuideContData((prev) =>
            prev.map((guide) =>
              guide.localDraftId === activeGuide.localDraftId
                ? { ...guide, revisionId: id }
                : guide
            )
          );
        }
      }

      if (type === "variant") {
        storeContributionDraft(
          "variant",
          variantContData,
          variantLocalDraftId,
          id,
          step
        );
      }

      if (type === "objective") {
        storeContributionDraft(
          "objective",
          objectiveContData,
          objectiveLocalDraftId,
          id,
          step
        );
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

  // objective validation
  const missingObjectiveFields = () => {
    const missing: Array<{ field: string; label: string }> = [];

    if (!objectiveContData.title.trim()) {
      missing.push({
        field: "title",
        label: "a title",
      });
    }

    if (!objectiveContData.summary.trim()) {
      missing.push({
        field: "summary",
        label: "a summary",
      });
    }

    if (showChangeSummary && !objectiveContData.changeSummary.trim()) {
      missing.push({
        field: "changeSummary",
        label: "a change summary",
      });
    }

    if (objectiveContData.subjects.length === 0) {
      missing.push({
        field: "subjects",
        label: "a subject",
      });
    }

    if (objectiveContData.targets.length === 0) {
      missing.push({
        field: "targets",
        label: "a target guide",
      });
    } else if (!objectiveContData.featuredSubObjective) {
      missing.push({
        field: "featuredSubObjective",
        label: "a featured sub-objective",
      });
    }

    return missing;
  };

  const invalidObjectiveFields = publishAttempted
    ? new Set(missingObjectiveFields().map((m) => m.field))
    : undefined;

  // publish
  const publish = async () => {
    setSubmitting(true);

    try {
      if (type === "guide") {
        const text = activeGuide.body.trim();

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

      if (!id) {
        throw new Error("Failed to save draft before publishing");
      }

      if (type === "objective") {
        await submitObjectiveRevision(id);

        objectiveSave.cancel();

        clearStoredDraft(objectiveLocalDraftId);
        setObjectiveContData(createObjectiveContData());
        setRevisionId(null);
        onPublished?.();

        toast.success("Objective published");

        return;
      }

      if (type === "guide") {
        await submitRevision(id);

        guideSave.cancel();

        /**
         * only delete the ACTIVE guide's local draft
         * other guides in the multi-guide UI remain untouched
         * TODO: publish all guides on button click - not just active draft
         */
        clearStoredDraft(activeGuide.localDraftId);

        // remove only the published guide from the current multi-guide session
        setGuideContData((prev) =>
          prev.filter(
            (guide) => guide.localDraftId !== activeGuide.localDraftId
          )
        );

        // Select another guide if one exists.
        const remaining = guideContData.filter(
          (guide) => guide.localDraftId !== activeGuide.localDraftId
        );

        if (remaining.length > 0) {
          setActiveGuideId(remaining[0].localDraftId);
        } else {
          const newGuide = createMultiGuide();
          setGuideContData([newGuide]);
          setActiveGuideId(newGuide.localDraftId);
        }

        setRevisionId(null);
        onPublished?.();

        toast.success("Submitted for review");

        return;
      }

      if (type === "variant") {
        await submitRevision(id);

        variantSave.cancel();

        clearStoredDraft(variantLocalDraftId);
        setVariantContData(createVariantContData());
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

  if (skipTypeStep && !type) {
    return null;
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-6 pb-20 sm:pb-0">
      <MobileStepProgress steps={visibleSteps} activeStep={activeStep} />

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

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {!skipTypeStep && (
          <SelectType pickType={pickType} type={type} Stepper={Stepper} />
        )}

        <GuideInfo
          Stepper={Stepper}
          type={type}
          guideContData={activeGuide}
          onGuideChange={updateActiveGuide}
          guides={guideContData}
          subjects={subjectOptions}
          guideOptions={guideOptions}
          activeGuideId={activeGuideId}
          onSelectGuide={setActiveGuideId}
          onAddGuide={addGuide}
          onDeleteGuide={removeGuide}
          body={type === "guide" ? activeGuide.body : variantContData.body}
          onBodyChange={(body) => {
            if (type === "guide") {
              updateActiveGuide({ body });
            } else {
              setVariantContData((prev) => ({ ...prev, body }));
            }
          }}
          onUploadImage={uploadGuideImage}
          hideBackBtn={skipTypeStep}
          onSaveDraft={saveDraft}
          submitting={submitting}
        />

        <PreviewGuide
          Stepper={Stepper}
          type={type}
          guides={guideContData}
          subjects={subjectOptions}
          activeGuideId={activeGuideId}
          onSelectGuide={setActiveGuideId}
          onAddGuide={addGuide}
          onDeleteGuide={removeGuide}
          onSaveDraft={saveDraft}
          onPublish={publish}
          submitting={submitting}
        />

        <VariantInfo
          Stepper={Stepper}
          type={type}
          variantContData={variantContData}
          onVariantChange={updateActiveVariant}
          guides={guideOptions}
          subjects={subjectOptions}
          body={variantContData.body}
          onBodyChange={(body) => updateActiveVariant({ body })}
          hideBackBtn={skipTypeStep}
          onSaveDraft={saveDraft}
          submitting={submitting}
        />

        <PreviewVariant
          Stepper={Stepper}
          type={type}
          guide={variantContData}
          subjects={subjectOptions}
          onSaveDraft={saveDraft}
          onPublish={publish}
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

        <OrderObjectiveGuides
          Stepper={Stepper}
          objectiveContData={objectiveContData}
          setObjectiveContData={setObjectiveContData}
          onSaveDraft={saveDraft}
          submitting={submitting}
          guides={guideOptions}
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
