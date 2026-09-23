import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/combobox";

import { Button } from "@/components/ui/button";

type GuideOption = {
  slug: string | null;
  title: string | null;
  summary: string | null;
};

type PropTypes = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guides: Array<GuideOption>;
  selectedExistingGuides: Array<string>;
  setSelectedExistingGuides: Dispatch<SetStateAction<Array<string | null>>>;
};

export const AddGuideNodeModal = ({
  open,
  onOpenChange,
  guides,
  selectedExistingGuides,
  setSelectedExistingGuides,
}: PropTypes) => {
  const guideItems = guides
    .filter((g): g is GuideOption & { slug: string } => !!g.slug)
    .map((g) => {
      return {
        value: g.slug,
        label: g.title ?? g.slug,
        description: g.summary ?? undefined,
      };
    });

  const onExistingGuidesSelected = () => {};

  const handleAddExistingGuides = async () => {};

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="gap-2 border-b border-border px-6 py-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="mono-micro">Guides</span>
          </div>

          <DialogTitle className="editorial-heading text-2xl">
            Select Existing Guides
          </DialogTitle>

          <DialogDescription className="text-xs text-muted-foreground">
            Add existing guides to the objective.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6">
          {/* {!loading ? ( */}
          <Combobox
            multiple
            items={guideItems}
            value={selectedExistingGuides}
            onValueChange={onExistingGuidesSelected}
            placeholder="Select existing guides..."
          />
          {/* ) : (
                        <p>Loading Existing Guides</p>
                    )} */}
        </div>

        <DialogFooter className="p-5 pt-0">
          <DialogClose asChild>
            <Button
              variant="outline"
              size="lg"
              className="btn-sec"
              onClick={handleCancel}
            >
              Cancel
            </Button>
          </DialogClose>
          <Button
            size="lg"
            className="btn-pri"
            onClick={handleAddExistingGuides}
            disabled={selectedExistingGuides.length === 0}
          >
            Add Guides
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
