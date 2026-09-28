import { Check, CircleAlert, LoaderCircle, Scroll } from "lucide-react";
import { createContext, useContext, useState } from "react";

import type { ContributionType } from "@/types/contributions";
import { Separator } from "@/components/ui/separator";
import { GuidelinesModal } from "@/components/modals/GuidelinesModal";
import { GuideSubmitModal } from "@/components/modals/GuideSubmitModal";
import { ObjectivePublishModal } from "@/components/modals/ObjectivePublishModal";

export type DraftSaveStatus = "idle" | "saving" | "saved" | "error";

export const DraftSaveStatusContext = createContext<DraftSaveStatus>("idle");

type PropTypes = {
  title: string;
  Stepper: any;
  type?: ContributionType | null;
  nextDisabled?: boolean;
  hideBackBtn?: boolean;
  hideGuidelines?: boolean;
  submitting?: boolean;
  publishLabel?: string;
  guideCount?: number;
  onSaveDraft?: () => void | boolean | Promise<void | boolean>;
  onPublish?: () => void;
};

export const StepperActionHeader = ({
  title,
  Stepper,
  type,
  nextDisabled,
  submitting,
  publishLabel = "Submit for Review",
  guideCount = 1,
  hideBackBtn,
  hideGuidelines,
  onSaveDraft,
  onPublish,
}: PropTypes) => {
  const [openGuidelineModal, setOpenGuidelineModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const saveStatus = useContext(DraftSaveStatusContext);

  const toggleGuidelineModal = () => setOpenGuidelineModal(!openGuidelineModal);
  const toggleSubmitModal = () => setShowSubmitModal(!showSubmitModal);
  const handleSubmit = () => setShowSubmitModal(!showSubmitModal);

  // batch submit feedback so it's more obvious for the user
  const submitLabel = guideCount > 1 ? `Submit All for Review` : publishLabel;
  const compactSubmitLabel = guideCount > 1 ? `Submit All` : "Submit";

  const saveIndicator =
    saveStatus === "saving" ? (
      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        Saving draft...
      </span>
    ) : saveStatus === "error" ? (
      <span className="inline-flex items-center gap-2 text-sm text-destructive">
        <CircleAlert className="size-4" />
        Draft not saved
      </span>
    ) : saveStatus === "saved" ? (
      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Check className="size-4" />
        Draft saved
      </span>
    ) : null;

  return (
    <>
      <div className="mb-4 hidden items-center justify-between sm:flex">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            {title}
          </h1>
          {type != "objective" && !hideGuidelines && (
            <button
              type="button"
              className="btn-sec inline-flex items-center gap-2 disabled:pointer-events-none disabled:opacity-50"
              onClick={toggleGuidelineModal}
            >
              <Scroll className="size-4" />
              View Guidelines
            </button>
          )}
        </div>

        <div className="text-mono flex flex-wrap gap-2 sm:gap-4">
          {!hideBackBtn && (
            <Stepper.Prev className="btn-sec">Back</Stepper.Prev>
          )}

          {onSaveDraft && saveIndicator}

          {onPublish ? (
            <button
              type="button"
              className="btn-pri disabled:pointer-events-none disabled:opacity-50"
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitLabel}
            </button>
          ) : (
            <Stepper.Next className="btn-pri" disabled={nextDisabled}>
              Next
            </Stepper.Next>
          )}
        </div>
      </div>

      <Separator className="hidden bg-border sm:block" />

      {(onSaveDraft || !hideBackBtn || onPublish) && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex w-full items-center gap-1.5 overflow-hidden border-t bg-background/95 px-2 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden">
          <div className="shrink-0">
            {!hideBackBtn && (
              <Stepper.Prev className="btn-sec inline-flex items-center px-3 whitespace-nowrap">
                Back
              </Stepper.Prev>
            )}
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 overflow-x-auto">
            {type != "objective" && !hideGuidelines && (
              <button
                type="button"
                aria-label="View guidelines"
                className="btn-sec inline-flex shrink-0 items-center gap-1.5 px-2.5 whitespace-nowrap disabled:pointer-events-none disabled:opacity-50"
                onClick={toggleGuidelineModal}
              >
                <Scroll className="size-4 shrink-0" />
                <span className="hidden min-[400px]:inline">
                  View Guidelines
                </span>
              </button>
            )}

            {onSaveDraft && saveIndicator}
          </div>

          <div className="shrink-0">
            {onPublish ? (
              <button
                type="button"
                className="btn-pri inline-flex items-center px-3 whitespace-nowrap disabled:pointer-events-none disabled:opacity-50"
                disabled={submitting}
                onClick={handleSubmit}
              >
                {publishLabel.toLowerCase().startsWith("submit")
                  ? compactSubmitLabel
                  : publishLabel}
              </button>
            ) : (
              <Stepper.Next
                className="btn-pri inline-flex items-center px-3 whitespace-nowrap"
                disabled={nextDisabled}
              >
                Next
              </Stepper.Next>
            )}
          </div>
        </div>
      )}

      <GuidelinesModal
        open={openGuidelineModal}
        onOpenChange={toggleGuidelineModal}
      />

      {type == "objective" ? (
        <ObjectivePublishModal
          open={showSubmitModal}
          onOpenChange={toggleSubmitModal}
          submitting={submitting}
          publishLabel={publishLabel}
          onPublish={onPublish}
        />
      ) : (
        <GuideSubmitModal
          open={showSubmitModal}
          onOpenChange={toggleSubmitModal}
          submitting={submitting}
          guideCount={guideCount}
          onPublish={onPublish}
        />
      )}
    </>
  );
};
