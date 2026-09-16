import { useState } from "react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { GuidelinesModal } from "@/components/modals/GuidelinesModal";

type PropsTypes = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submitting: boolean | undefined;
  guideCount?: number;
  onPublish: (() => void) | undefined;
};

export const GuideSubmitModal = ({
  open,
  onOpenChange,
  submitting,
  guideCount = 1,
  onPublish,
}: PropsTypes) => {
  const [acceptGuidelines, setAcceptGuidelines] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);

  // batch submit feedback
  const batch = guideCount > 1;
  const title = batch
    ? `Submit all ${guideCount} guides?`
    : "Are you sure you want to submit?";
  const confirmLabel = batch ? `Submit All` : "Submit";

  const handleSubmit = () => {
    if (onPublish && acceptGuidelines) {
      onPublish();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="gap-2 p-5 pb-0">
          <span className="mono-micro text-muted-foreground">
            Submit for review
          </span>
          <DialogTitle className="editorial-heading text-lg">
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Your work goes into the review queue, where a curator checks it
            against the Guide Guidelines. Nothing is published until it is
            approved. If changes are needed, you will get feedback and can
            resubmit.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-3 p-5">
          <Checkbox
            id="guidelines-checkbox"
            name="guidelines-checkbox"
            className="mt-0.5 border-primary"
            checked={acceptGuidelines}
            onCheckedChange={(isTicked) =>
              setAcceptGuidelines(isTicked === true)
            }
          />

          <FieldLabel
            htmlFor="guidelines-checkbox"
            className="block text-xs leading-relaxed text-muted-foreground"
          >
            I have read and agree that I have followed the{" "}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowGuidelines(true);
              }}
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              Guide Guidelines
            </button>
            .
          </FieldLabel>
        </div>

        <DialogFooter className="p-5 pt-0">
          <DialogClose asChild>
            <Button variant="outline" size="lg" className="btn-sec">
              Cancel
            </Button>
          </DialogClose>
          <Button
            size="lg"
            className="btn-pri"
            disabled={submitting || !acceptGuidelines}
            onClick={handleSubmit}
          >
            {submitting ? "Submitting..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>

      <GuidelinesModal open={showGuidelines} onOpenChange={setShowGuidelines} />
    </Dialog>
  );
};
