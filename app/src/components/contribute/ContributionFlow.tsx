import { defineStepper } from "@stepperize/react";
import { useMemo, useState } from "react";

import type { ContributionType } from "@/types/contributions";

import { flows, typeStep } from "@/lib/contributionFlow";

import { SelectType } from "@/components/contribute/steps/SelectType";
import { SubjectDetails } from "@/components/contribute/steps/SubjectDetails";
import { GuideDetails } from "@/components/contribute/steps/GuideDetails";
import { VariantDetails } from "@/components/contribute/steps/VariantDetails";
import { Content } from "@/components/contribute/steps/Content";
import { BaseGuide } from "@/components/contribute/steps/BaseGuide";
import { PathDetails } from "@/components/contribute/steps/PathDetails";
import { Submit } from "@/components/contribute/steps/Submit";
import { SelectPathGuides } from "@/components/contribute/steps/SelectPathGuides";
import { OrderPathGuides } from "@/components/contribute/steps/OrderPathGuides";

export default function ContributionFlow() {
  const [type, setType] = useState<ContributionType | null>(null);

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
}: {
  type: ContributionType | null;
  setType: (t: ContributionType) => void;
  useStepper: any;
  Stepper: any;
}) {
  const stepper = useStepper();

  const pickType = (value: ContributionType) => {
    setType(value);

    requestAnimationFrame(() => {
      let nextStep = "path-details";

      switch (value) {
        case "subject":
          nextStep = "subject-details";
          break;
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
    <div className="flex w-full gap-8">
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
      <div className="flex w-full flex-col">
        <SelectType pickType={pickType} type={type} Stepper={Stepper} />

        <SubjectDetails Stepper={Stepper} />
        <GuideDetails Stepper={Stepper} />
        <VariantDetails Stepper={Stepper} />
        <PathDetails Stepper={Stepper} />

        <BaseGuide Stepper={Stepper} />
        <Content Stepper={Stepper} />
        <SelectPathGuides Stepper={Stepper} />
        <OrderPathGuides Stepper={Stepper} />

        <Submit Stepper={Stepper} />
      </div>
    </div>
  );
}
