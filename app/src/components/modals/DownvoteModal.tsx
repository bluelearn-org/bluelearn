import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";

import type { DownvoteReason } from "@/lib/api/votes";
import type { ComboboxItem } from "@/components/ui/combobox";
import { downvoteReasonItems } from "@/lib/api/votes";
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
import { Combobox } from "@/components/ui/combobox";
import { FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

// A heading of the guide the downvote can point at: the anchor the table of
// contents links to, and the text shown for it.
export type DownvoteSection = { id: string; text: string };

type PropsTypes = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submitting: boolean;
  existing: {
    reason: DownvoteReason | null;
    note: string | null;
    section_ref?: string | null;
  } | null;
  // The guide's headings; with none, the downvote can only flag the whole guide.
  sections?: Array<DownvoteSection>;
  onSubmit: (
    reason: DownvoteReason,
    note: string,
    sectionRef: string | null
  ) => void;
  onRemove: () => void;
};

// The picker needs a non-empty value for "the whole guide". Heading anchors
// only ever contain [a-z0-9-], so "*" can never collide with one.
const WHOLE_GUIDE = "*";

export const DownvoteModal = ({
  open,
  onOpenChange,
  submitting,
  existing,
  sections = [],
  onSubmit,
  onRemove,
}: PropsTypes) => {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [section, setSection] = useState(WHOLE_GUIDE);

  useEffect(() => {
    if (!open) return;
    setReason(existing?.reason ?? "");
    setNote(existing?.note ?? "");
    setSection(existing?.section_ref ?? WHOLE_GUIDE);
  }, [open, existing]);

  const sectionItems = useMemo(() => {
    const items: Array<ComboboxItem> = [
      { value: WHOLE_GUIDE, label: "Whole guide" },
      ...sections.map((s) => ({ value: s.id, label: s.text })),
    ];
    // A stored pointer to a heading that has since been renamed still has to
    // show, or the picker would silently drop it on the next save.
    if (section !== WHOLE_GUIDE && !sections.some((s) => s.id === section)) {
      items.push({ value: section, label: section });
    }
    return items;
  }, [sections, section]);

  const handleSubmit = () => {
    if (!reason || submitting) return;
    onSubmit(
      reason as DownvoteReason,
      note.trim(),
      section === WHOLE_GUIDE ? null : section
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="gap-2 p-5 pb-0">
          <span className="mono-micro text-muted-foreground">Downvote</span>
          <DialogTitle className="editorial-heading text-lg">
            {existing ? "Update your downvote" : "Why this downvote?"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            A downvote needs a reason so the author knows what to fix. Only the
            reason is required; the note is yours to add if it helps.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-5">
          <div className="space-y-2">
            <FieldLabel className="text-xs">Reason</FieldLabel>
            <Combobox
              items={downvoteReasonItems}
              value={reason}
              onValueChange={setReason}
              disabled={submitting}
              modal
            />
          </div>

          {sectionItems.length > 1 && (
            <div className="space-y-2">
              <FieldLabel className="text-xs">Which section?</FieldLabel>
              <Combobox
                items={sectionItems}
                value={section}
                onValueChange={setSection}
                disabled={submitting}
                modal
              />
            </div>
          )}

          <div className="space-y-2">
            <FieldLabel htmlFor="downvote-note" className="text-xs">
              Note (optional)
            </FieldLabel>
            <Textarea
              id="downvote-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={submitting}
              placeholder="Add anything the author should know."
            />
          </div>
        </div>

        <DialogFooter className="p-5 pt-0">
          {existing && (
            <Button
              variant="destructive"
              size="lg"
              className="mr-auto"
              disabled={submitting}
              onClick={onRemove}
            >
              <Trash2 className="h-4 w-4" />
              Remove vote
            </Button>
          )}

          <DialogClose asChild>
            <Button variant="outline" size="lg" className="btn-sec">
              Cancel
            </Button>
          </DialogClose>

          <Button
            size="lg"
            className="btn-pri"
            disabled={submitting || !reason}
            onClick={handleSubmit}
          >
            {submitting ? "Submitting..." : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
