import { Separator } from "@/components/ui/separator";

export const StepperActionHeader = ({
  title,
  Stepper,
  nextDisabled,
}: {
  title: string;
  Stepper: any;
  nextDisabled?: boolean;
}) => {
  return (
    <>
      <div className="my-4 flex items-center justify-between">
        <h2 className="line-clamp-2 text-xl font-semibold tracking-tight">
          {title}
        </h2>

        <div className="text-mono flex justify-between gap-4">
          <Stepper.Prev className="btn-sec">Back</Stepper.Prev>

          <Stepper.Next className="btn-pri" disabled={nextDisabled}>
            Next
          </Stepper.Next>
        </div>
      </div>

      <Separator className="mb-8 bg-border" />
    </>
  );
};
