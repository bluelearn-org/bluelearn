import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  MessageSquareText,
  MessageSquareWarning,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";

import type { PanelDecision } from "@/components/review/DecisionList";
import { DecisionList } from "@/components/review/DecisionList";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getRevision } from "@/lib/api/guideRevisions";
import { getReviewCase } from "@/lib/api/reviews";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/useMediaQuery";

type MobileProps = {
  caseId: string;
  decisions: Array<PanelDecision>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const CaseLink = ({ caseId }: { caseId: string }) => (
  <Link
    to="/review/$caseId"
    params={{ caseId }}
    className="mono-micro text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
  >
    View the closed case
  </Link>
);

/**
 * mobile replacement for the feedback column
 * panel feedback slides in from the right as Sheet
 */
const MobileRejectionFeedback = ({
  caseId,
  decisions,
  open,
  onOpenChange,
}: MobileProps) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="gap-0">
      <SheetHeader>
        <SheetTitle className="font-mono tracking-[0.08em] uppercase">
          Panel Feedback
        </SheetTitle>
        <SheetDescription className="sr-only">
          Reviewer decisions from the case that sent this draft back.
        </SheetDescription>
      </SheetHeader>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-6">
        <CaseLink caseId={caseId} />
        <DecisionList decisions={decisions} />
      </div>
    </SheetContent>
  </Sheet>
);

export const RejectionFeedback = ({ draftId }: { draftId: string }) => {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Array<PanelDecision>>([]);
  const [open, setOpen] = useState(true);

  // Mobile open/close
  const [sheetOpen, setSheetOpen] = useState(false);

  const isDesktop = useMediaQuery("(min-width: 60rem)");
  const buttonHidden = isDesktop && open;

  useEffect(() => {
    const controller = new AbortController();
    const opts = { signal: controller.signal };

    getRevision(draftId, opts)
      .then(({ revised_from_case_id }) => {
        if (!revised_from_case_id) return;
        return getReviewCase(revised_from_case_id, opts).then((data) => {
          setCaseId(revised_from_case_id);
          setDecisions(data.decisions);
        });
      })
      .catch(() => {});

    return () => controller.abort();
  }, [draftId]);

  if (!caseId) return null;

  return (
    <>
      <MobileRejectionFeedback
        caseId={caseId}
        decisions={decisions}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />

      <Button
        variant="ghost"
        size="icon"
        aria-label="Show panel feedback"
        aria-hidden={buttonHidden}
        tabIndex={buttonHidden ? -1 : 0}
        className={cn(
          "absolute top-[39px] right-7 transition-opacity",
          buttonHidden
            ? "pointer-events-none opacity-0 duration-75"
            : "opacity-100 delay-250 duration-150"
        )}
        onClick={() => (isDesktop ? setOpen(true) : setSheetOpen(true))}
      >
        <PanelRightOpen className="size-5" />
      </Button>

      <div
        className={cn(
          "hidden:md -mt-8 -mr-8 -mb-8 shrink-0 transition-[width] duration-400 ease-out [clip-path:inset(0)] md:block lg:-mr-16",
          open ? "w-[320px] border-l" : "w-0"
        )}
      >
        <aside className="sticky top-[65px] max-h-[calc(100vh-65px)] w-[320px] space-y-4 overflow-y-auto px-6 pt-[39px] pb-8">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-[11px] font-bold tracking-[0.08em] uppercase">
                Panel Feedback
              </p>

              <Button
                variant="ghost"
                size="icon"
                aria-label="Hide panel feedback"
                className="-mr-1"
                onClick={() => setOpen(false)}
              >
                <PanelRightClose className="size-5" />
              </Button>
            </div>

            <CaseLink caseId={caseId} />
          </div>

          <DecisionList decisions={decisions} />
        </aside>
      </div>
    </>
  );
};
