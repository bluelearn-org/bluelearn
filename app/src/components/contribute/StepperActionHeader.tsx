import { Separator } from "@/components/ui/separator";

export const StepperActionHeader = ({
  title,
  Stepper,
  nextDisabled,
  hideNext,
  onNextClick,
}: {
  title: string;
  Stepper: any;
  nextDisabled?: boolean;
  hideNext?: boolean;
  onNextClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) => {
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="ml-1 font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
          {title}
        </h1>

        <div className="text-mono flex justify-between gap-4">
          <Stepper.Prev className="btn-sec">Back</Stepper.Prev>

          {!hideNext && (
            <Stepper.Next
              className="btn-pri"
              disabled={nextDisabled}
              onClick={onNextClick}
            >
              Next
            </Stepper.Next>
          )}
        </div>
      </div>

      <Separator className="mb-8 bg-border" />
    </>
  );
};
