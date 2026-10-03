import { useState } from "react";
import { PanelLeftOpen } from "lucide-react";

import type { GuideOption } from "@/components/sidebar/EditorSidebar";

import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { DraftActions, DraftList } from "@/components/sidebar/EditorSidebar";

type Props = {
  guides: Array<GuideOption>;
  activeGuideId: string;

  onSelectGuide: (localDraftId: string) => void;
  onAddGuide: () => void;
  onDeleteGuide: (localDraftId: string) => void;
};

/**
 * mobile replacement for EditorSidebar - a bar showing the active draft
 * that opens the draft list in a sheet sliding in from the left
 */
export const MobileDraftSwitcher = ({
  guides,
  activeGuideId,
  onSelectGuide,
  onAddGuide,
  onDeleteGuide,
}: Props) => {
  const [open, setOpen] = useState(false);

  const activeIndex = guides.findIndex(
    (guide) => guide.localDraftId === activeGuideId
  );
  const activeTitle =
    guides[activeIndex]?.title.trim() || `Guide ${activeIndex + 1}`;

  const selectGuide = (localDraftId: string) => {
    onSelectGuide(localDraftId);
    setOpen(false);
  };

  const addGuide = () => {
    onAddGuide();
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="mb-4 flex min-h-11 w-full items-center gap-3 rounded-md border px-3 text-left"
          aria-label={`Drafts: guide ${activeIndex + 1} of ${guides.length}, ${activeTitle}`}
        >
          <span className="data-label shrink-0 text-muted-foreground">
            {activeIndex + 1} / {guides.length}
          </span>
          <span className="data-label min-w-0 flex-1 truncate font-bold">
            {activeTitle}
          </span>
          <PanelLeftOpen className="h-4 w-4 shrink-0" />
        </button>
      </SheetTrigger>

      <SheetContent side="left" className="gap-0">
        <SheetHeader>
          <SheetTitle className="font-mono tracking-[0.08em] uppercase">
            Drafts
          </SheetTitle>
          <SheetDescription className="sr-only">
            Switch between, add or remove guide drafts.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4">
          <DraftActions
            guideCount={guides.length}
            activeGuideId={activeGuideId}
            onAddGuide={addGuide}
            onDeleteGuide={onDeleteGuide}
          />
        </div>

        <Separator />

        <div className="min-h-0 flex-1 overflow-y-auto px-2">
          <DraftList
            guides={guides}
            activeGuideId={activeGuideId}
            onSelectGuide={selectGuide}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};
