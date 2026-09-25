import { Check, HardDrive, Loader2, Save, Scroll } from "lucide-react";
import { useEffect, useState } from "react";

import type { ContributionType } from "@/types/contributions";
import type { AnyStoredDraft } from "@/lib/contributionStorage";

import { Separator } from "@/components/ui/separator";
import { GuidelinesModal } from "@/components/modals/GuidelinesModal";
import { GuideSubmitModal } from "@/components/modals/GuideSubmitModal";
import { ObjectivePublishModal } from "@/components/modals/ObjectivePublishModal";
import { getAllStoredDrafts } from "@/lib/contributionStorage";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  guideCount?: number;
  // whether the current draft has edits that haven't been saved yet
  isDirty?: boolean;
  // whether the locally saved content is confirmed saved to the server too
  isSynced?: boolean;
  onSaveDraft?: () => void | boolean | Promise<void | boolean>;
  onPublish?: () => void;
};

type SaveStatus = "saving" | "unsaved" | "saved-locally" | "saved";

const SaveStatusIndicator = ({
  status,
  labelClassName = "",
}: {
  status: SaveStatus;
  labelClassName?: string;
}) => {
  const label = (
    <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-xs tracking-[0.08em] uppercase">
      {status === "saving" && (
        <>
          <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
          <span className={`text-muted-foreground ${labelClassName}`}>
            Saving
          </span>
        </>
      )}

      {status === "unsaved" && (
        <>
          <span className="size-1.5 shrink-0 rounded-full bg-amber-500" />
          <span
            className={`text-amber-700 dark:text-amber-400 ${labelClassName}`}
          >
            Unsaved
          </span>
        </>
      )}

      {(status === "saved" || status === "saved-locally") && (
        <>
          {status === "saved" ? (
            <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <HardDrive className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          )}
          <span
            className={`text-emerald-700 dark:text-emerald-400 ${labelClassName}`}
          >
            Saved
          </span>
        </>
      )}
    </span>
  );

  if (status !== "saved-locally") {
    return label;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0}>{label}</span>
      </TooltipTrigger>
      <TooltipContent>
        Saved in this browser - Save Draft to sync to your account.
      </TooltipContent>
    </Tooltip>
  );
};

export const StepperActionHeader = ({
  title,
  Stepper,
  type,
  nextDisabled,
  submitting,
  saveDisabled,
  publishLabel = "Submit for Review",
  guideCount = 1,
  isDirty,
  isSynced,
  hideBackBtn,
  hideGuidelines,
  onSaveDraft,
  onPublish,
}: PropTypes) => {
  const [openGuidelineModal, setOpenGuidelineModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [allStoredDrafts, setAllStoredDrafts] = useState<Array<AnyStoredDraft>>(
    []
  );

  const toggleGuidelineModal = () => setOpenGuidelineModal(!openGuidelineModal);
  const toggleSubmitModal = () => setShowSubmitModal(!showSubmitModal);
  const handleSubmit = () => setShowSubmitModal(!showSubmitModal);

  // batch submit feedback so it's more obvious for the user
  const submitLabel = guideCount > 1 ? `Submit All for Review` : publishLabel;
  const compactSubmitLabel = guideCount > 1 ? `Submit All` : "Submit";

  const saveStatus: SaveStatus = submitting
    ? "saving"
    : isDirty
      ? "unsaved"
      : isSynced === false
        ? "saved-locally"
        : "saved";

  useEffect(() => {
    // get all drafts from localstorage
    setAllStoredDrafts(getAllStoredDrafts());
  }, []);

  const saveDraft = async () => {
    if (!onSaveDraft) return;
    const didSave = await onSaveDraft();
    if (didSave === false) return;

    // a new draft may now exist locally, refresh the count
    setAllStoredDrafts(getAllStoredDrafts());
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

        <div className="text-mono flex flex-wrap items-center gap-2 sm:gap-4">
          {onSaveDraft && typeof isDirty === "boolean" && (
            <SaveStatusIndicator status={saveStatus} />
          )}

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

            {onSaveDraft && typeof isDirty === "boolean" && (
              <SaveStatusIndicator
                status={saveStatus}
                labelClassName="hidden min-[400px]:inline"
              />
            )}

            {onSaveDraft && (
              <button
                type="button"
                className="btn-sec inline-flex shrink-0 items-center gap-1.5 px-2.5 whitespace-nowrap disabled:pointer-events-none disabled:opacity-50"
                disabled={submitting || saveDisabled}
                onClick={saveDraft}
              >
                <Save className="size-3.5 shrink-0" />
                Save draft
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
