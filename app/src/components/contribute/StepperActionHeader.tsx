import { Separator } from "@/components/ui/separator";

export const StepperActionHeader = ({
  title,
  Stepper,
}: {
  title: string;
  Stepper: any;
}) => {
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="ml-1 font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
          {title}
        </h1>

        <div className="text-mono flex justify-between gap-4">
          <Stepper.Prev className="btn-sec">Back</Stepper.Prev>

          <Stepper.Next className="btn-pri">Next</Stepper.Next>
        </div>
      </div>

      <Separator className="mb-8 bg-border" />
    </>
  );
};
