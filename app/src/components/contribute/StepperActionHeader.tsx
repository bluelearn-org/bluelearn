import { Check, Save, Scroll } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { ContributionType } from "@/types/contributions";
import type { AnyStoredDraft } from "@/lib/contributionStorage";

import { Separator } from "@/components/ui/separator";
import { GuidelinesModal } from "@/components/modals/GuidelinesModal";
import { GuideSubmitModal } from "@/components/modals/GuideSubmitModal";
import { ObjectivePublishModal } from "@/components/modals/ObjectivePublishModal";
import { getAllStoredDrafts } from "@/lib/contributionStorage";

type PropTypes = {
  title: string;
  Stepper: any;
  type?: ContributionType | null;
  nextDisabled?: boolean;
  hideBackBtn?: boolean;
  hideGuidelines?: boolean;
  submitting?: boolean;
  saveDisabled?: boolean;
  publishLabel?: string;
  onSaveDraft?: () => void | boolean | Promise<void | boolean>;
  onPublish?: () => void;
};

export const StepperActionHeader = ({
  title,
  Stepper,
  type,
  nextDisabled,
  submitting,
  saveDisabled,
  publishLabel = "Submit for Review",
  hideBackBtn,
  hideGuidelines,
  onSaveDraft,
  onPublish,
}: PropTypes) => {
  const [openGuidelineModal, setOpenGuidelineModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [saved, setSaved] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [allStoredDrafts, setAllStoredDrafts] = useState<Array<AnyStoredDraft>>(
    []
  );

  const toggleGuidelineModal = () => setOpenGuidelineModal(!openGuidelineModal);
  const toggleSubmitModal = () => setShowSubmitModal(!showSubmitModal);
  const handleSubmit = () => setShowSubmitModal(!showSubmitModal);

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  useEffect(() => {
    // get all drafts from localstorage
    const allDrafts = getAllStoredDrafts();
    setAllStoredDrafts(allDrafts);
  }, [saved]); // TODO: should get drafts when a new draft is added to the workspace

  const saveDraft = async () => {
    if (!onSaveDraft) return;
    const didSave = await onSaveDraft();
    if (didSave === false) return;

    setSaved(true);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setSaved(false), 2000);
  };

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
          {onSaveDraft && (
            <button
              type="button"
              className="btn-sec inline-flex items-center gap-2 disabled:pointer-events-none disabled:opacity-50"
              disabled={submitting || saveDisabled}
              onClick={saveDraft}
            >
              <Save className="size-4" />
              {allStoredDrafts.length > 1 ? "Save Drafts" : "Save Draft"}
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
              onClick={handleSubmit}
            >
              {publishLabel}
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

            {onSaveDraft && (
              <button
                type="button"
                className="btn-sec inline-flex shrink-0 items-center gap-1.5 px-2.5 whitespace-nowrap disabled:pointer-events-none disabled:opacity-50"
                disabled={submitting || saveDisabled}
                onClick={saveDraft}
              >
                {saved ? (
                  <>
                    <Check className="size-3.5 shrink-0" />
                    Saved
                  </>
                ) : (
                  <>
                    <Save className="size-3.5 shrink-0" />
                    Save draft
                  </>
                )}
              </button>
            )}
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
                  ? "Submit"
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
          onPublish={onPublish}
        />
      )}
    </>
  );
};
