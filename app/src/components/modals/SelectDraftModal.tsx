import { useEffect, useState } from "react";

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

import { getGuideDrafts } from "@/lib/api/identity";
import { getStoredDraftsByType } from "@/lib/contributionStorage";
import { Button } from "@/components/ui/button";
import { getRevision } from "@/lib/api/guideRevisions";

type GuideDraft = {
  revision_id: string;
  guide_id: string;
  title: string;
  guide_slug: string | null;
  created_at: string;
  updated_at: string;
};

type PropTypes = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDrafts: Array<string>;
  onDraftsChange: (draftIds: Array<string>) => void;
};

export const SelectDraftModal = ({
  open,
  onOpenChange,
  selectedDrafts,
  onDraftsChange,
}: PropTypes) => {
  const [drafts, setDrafts] = useState<Array<GuideDraft>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    async function fetchDrafts() {
      setLoading(true);

      try {
        const serverDrafts = await getGuideDrafts();
        const localDrafts = getStoredDraftsByType("guide");

        const localRevisionIds = new Set(
          localDrafts
            .map((draft) => draft.revisionId)
            .filter((revisionId): revisionId is string => revisionId !== null)
        );

        // Only show server drafts that aren't already in localStorage
        const availableDrafts = serverDrafts.filter(
          (draft) => !localRevisionIds.has(draft.revision_id)
        );

        if (!cancelled) {
          setDrafts(availableDrafts);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to fetch guide drafts:", error);
          setDrafts([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchDrafts();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const fetchSelectedDrafts = async (draftIds: Array<string>) => {
    // Fetch draft info given draft IDs from the database
    const drafts = await Promise.all(
      draftIds.map((draftId) => getRevision(draftId))
    );

    return drafts;
  };

  const handleAddDrafts = async () => {
    onDraftsChange(selectedDrafts);
    const drafts = await fetchSelectedDrafts(selectedDrafts);

    onOpenChange(false);
  };
  const handleCancel = () => {
    onDraftsChange([]);
    onOpenChange(false);
  };

  const items = drafts.map((draft) => ({
    value: draft.revision_id,
    label: draft.title || "Untitled Draft",
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="gap-2 border-b border-border px-6 py-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="mono-micro">Drafts</span>
          </div>

          <DialogTitle className="editorial-heading text-2xl">
            Select Existing Drafts
          </DialogTitle>

          <DialogDescription className="text-xs text-muted-foreground">
            Add existing drafts that you have already created to edit multiple
            guides in one submission.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6">
          {!loading ? (
            <Combobox
              multiple
              items={items}
              value={selectedDrafts}
              onValueChange={onDraftsChange}
              placeholder="Select drafts..."
            />
          ) : (
            <p>Loading Drafts</p>
          )}
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
            onClick={handleAddDrafts}
            disabled={selectedDrafts.length === 0 || loading}
          >
            Add {selectedDrafts.length > 0 ? `${selectedDrafts.length} ` : ""}{" "}
            Draft{selectedDrafts.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
