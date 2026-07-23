import { Save } from "lucide-react";

import { Separator } from "@/components/ui/separator";

type PropTypes = {
  title: string;
  Stepper: any;
  nextDisabled?: boolean;
  hideNext?: boolean;
  onNextClick?: (e: React.MouseEvent) => void;
  hideBackBtn?: boolean;
  submitting?: boolean;
  onSaveDraft?: () => void;
  onPublish?: () => void;
  publishText?: string;
};

export const StepperActionHeader = ({
  title,
  Stepper,
  nextDisabled,
  hideNext,
  onNextClick,
  submitting,
  hideBackBtn,
  onSaveDraft,
  onPublish,
  publishText = "Submit for Review",
}: PropTypes) => {
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
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

          {!hideBackBtn && (
            <Stepper.Prev className="btn-sec">Back</Stepper.Prev>
          )}

          {onPublish ? (
            <button
              type="button"
              className="btn-pri disabled:pointer-events-none disabled:opacity-50"
              disabled={submitting}
              onClick={onPublish}
            >
              {publishText}
            </button>
          ) : !hideNext ? (
            <Stepper.Next
              className="btn-pri"
              disabled={nextDisabled}
              onClick={onNextClick}
            >
              Next
            </Stepper.Next>
          ) : null}
        </div>
      </div>

      <Separator className="mb-8 bg-border" />
    </>
  );
};
