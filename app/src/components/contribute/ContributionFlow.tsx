import { defineStepper } from "@stepperize/react";
import { ChevronRight } from "lucide-react";
import { Fragment, useMemo, useState } from "react";

import type { Dispatch, SetStateAction } from "react";

import type {
  ContributionType,
  GuideContribution,
  ObjectiveContribution,
} from "@/types/contributions";

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
  type: "",
  title: "",
  summary: "",
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
                <Stepper.Trigger className="rounded-md p-2 font-mono text-[12px] text-muted-foreground uppercase transition-colors hover:bg-muted data-[status=active]:font-bold data-[status=active]:text-brand-blue data-[status=previous]:text-foreground">
                  <Stepper.Title />
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
        />

        <VariantDetails Stepper={Stepper} />

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

        <Content Stepper={Stepper} />
        <OrderObjectiveGuides
          Stepper={Stepper}
          objectiveContData={objectiveContData}
          setObjectiveContData={setObjectiveContData}
        />

        <Submit Stepper={Stepper} />
      </div>
    </div>
  );
}
