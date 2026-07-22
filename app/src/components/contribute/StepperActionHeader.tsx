import { Save } from "lucide-react";

import { Separator } from "@/components/ui/separator";

export const StepperActionHeader = ({
  title,
  Stepper,
  nextDisabled,
  onSaveDraft,
  submitting,
}: {
  title: string;
  Stepper: any;
  nextDisabled?: boolean;
  onSaveDraft?: () => void;
  submitting?: boolean;
}) => {
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="ml-1 font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
          {title}
        </h1>

        <div className="text-mono flex justify-between gap-4">
          {onSaveDraft && (
            <button
              type="button"
              className="btn-sec inline-flex items-center gap-2 disabled:pointer-events-none disabled:opacity-50"
              disabled={submitting}
              onClick={onSaveDraft}
            >
              <Save className="size-4" />
              Save Draft
            </button>
          )}

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
