import { defineStepper } from "@stepperize/react";
import { useMemo, useState } from "react";

import type { Dispatch, SetStateAction } from "react";
import type {
  ContributionType,
  GuideContribution,
} from "@/types/contributions";

import { SelectType } from "@/components/contribute/steps/SelectType";
import { GuideDetails } from "@/components/contribute/steps/GuideDetails";
import { VariantDetails } from "@/components/contribute/steps/VariantDetails";
import { Content } from "@/components/contribute/steps/Content";
import { BaseGuide } from "@/components/contribute/steps/BaseGuide";
import { ObjectiveDetails } from "@/components/contribute/steps/ObjectiveDetails";
import { Submit } from "@/components/contribute/steps/Submit";
import { SelectObjectiveGuides } from "@/components/contribute/steps/SelectObjectiveGuides";
import { OrderObjectiveGuides } from "@/components/contribute/steps/OrderObjectiveGuides";

import { flows, typeStep } from "@/lib/contributionFlow";

export default function ContributionFlow() {
  const [type, setType] = useState<ContributionType | null>(null);
  const [guideContData, setGuideContData] = useState<GuideContribution>({
    type: "",
    title: "",
    summary: "",
    subjects: [],
    prereqs: [],
    todoPrereqs: [],
  });

  const StepperInstance = useMemo(() => {
    if (!type) {
      return defineStepper(typeStep);
    }

    return defineStepper([...typeStep, ...flows[type]]);
  }, [type]);

  const { Stepper, useStepper } = StepperInstance;

  return (
    <Stepper.Root className="flex h-full w-full">
      {() => (
        <Inner
          type={type}
          setType={setType}
          useStepper={useStepper}
          Stepper={Stepper}
          guideContData={guideContData}
          setGuideContData={setGuideContData}
        />
      )}
    </Stepper.Root>
  );
}

function Inner({
  type,
  setType,
  useStepper,
  Stepper,
  guideContData,
  setGuideContData,
}: {
  type: ContributionType | null;
  setType: (t: ContributionType) => void;
  useStepper: any;
  Stepper: any;
  guideContData: GuideContribution;
  setGuideContData: Dispatch<SetStateAction<GuideContribution>>;
}) {
  const stepper = useStepper();

  const pickType = (value: ContributionType) => {
    setType(value);

    requestAnimationFrame(() => {
      let nextStep = "objective-details";

      switch (value) {
        case "guide":
          nextStep = "guide-details";
          break;
        case "variant":
          nextStep = "variant-details";
          break;
      }

      stepper.goTo(nextStep);
    });
  };

  return (
    <div className="flex h-[calc(100vh_-_210px)] w-full gap-8">
      {/* sidebar */}
      <div className="w-64 border-r pr-4">
        <Stepper.List>
          <Stepper.Items>
            {(step: any, index: number) => (
              <Stepper.Item
                key={step.id}
                step={step.id}
                className="flex items-center gap-2 py-2"
              >
                <Stepper.Indicator className="grid size-8 place-items-center rounded-full border bg-badge text-xl">
                  {index + 1}
                </Stepper.Indicator>

                <Stepper.Title />
              </Stepper.Item>
            )}
          </Stepper.Items>
        </Stepper.List>
      </div>

      {/* content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <SelectType pickType={pickType} type={type} Stepper={Stepper} />

        <GuideDetails
          Stepper={Stepper}
          guideContData={guideContData}
          setGuideContData={setGuideContData}
        />
        <VariantDetails Stepper={Stepper} />
        <ObjectiveDetails Stepper={Stepper} />

        <BaseGuide Stepper={Stepper} />
        <Content Stepper={Stepper} />
        <SelectObjectiveGuides Stepper={Stepper} />
        <OrderObjectiveGuides Stepper={Stepper} />

        <Submit Stepper={Stepper} />
      </div>
    </div>
  );
}
