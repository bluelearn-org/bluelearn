import { defineStepper } from "@stepperize/react";
import { ChevronRight } from "lucide-react";
import { Fragment, useMemo } from "react";

import { SubObjectiveStep } from "@/components/objective/SubObjectiveStep";

type Props = {
  objective: any;
  targets: any;
};

export default function ObjectiveFlow({ objective, targets }: Props) {
  const StepperInstance = useMemo(() => {
    return defineStepper(
      targets.map((target: any) => ({
        id: target.slug,
        title: target.title,
      }))
    );
  }, [targets]);
  const { Stepper } = StepperInstance;

  return (
    <Stepper.Root className="flex min-h-0 w-full flex-1 flex-col gap-8">
      <Inner Stepper={Stepper} targets={targets} objective={objective} />
    </Stepper.Root>
  );
}

function Inner({
  Stepper,
  targets,
  objective,
}: {
  Stepper: any;
  targets: any;
  objective: any;
}) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-6">
      {/* breadcrumb stepper */}
      <Stepper.List className="flex w-full items-center justify-center text-sm">
        <Stepper.Items>
          {(step: any, index: number) => (
            <Fragment key={step.id}>
              {index > 0 && (
                <ChevronRight className="mx-1 size-4 text-muted-foreground/50" />
              )}

              <Stepper.Item step={step.id}>
                <Stepper.Trigger className="mono-micro flex items-center gap-2 rounded-full border border-border bg-background px-2 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted data-[status=active]:border-primary data-[status=active]:bg-primary/10 data-[status=active]:text-primary data-[status=active]:ring-1 data-[status=active]:ring-primary/20">
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
        {targets.map((target: any) => (
          <SubObjectiveStep
            key={target.slug}
            Stepper={Stepper}
            target={target}
            objective={objective}
          />
        ))}
      </div>
    </div>
  );
}
