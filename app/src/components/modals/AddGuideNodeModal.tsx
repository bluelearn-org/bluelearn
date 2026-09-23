import { useEffect, useState } from "react";
import type { GuideListItem } from "@bluelearn/schemas";

import type { ObjectiveGraphNode } from "@/types/contributions";
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
import { FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import { Button } from "@/components/ui/button";

type Mode = "existing" | "target" | "request";

type PropTypes = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guides: Array<GuideListItem>;
  existingGuideBaseIds: Array<string>;
  onAdd: (nodes: Array<ObjectiveGraphNode>) => void;
};

export const AddGuideNodeModal = ({
  open,
  onOpenChange,
  guides,
  existingGuideBaseIds,
  onAdd,
}: PropTypes) => {
  const [mode, setMode] = useState<Mode>("existing");
  const [selectedGuideIds, setSelectedGuideIds] = useState<Array<string>>([]);
  const [selectedTargetIds, setSelectedTargetIds] = useState<Array<string>>([]);
  const [requestTitle, setRequestTitle] = useState("");
  const [requestSummary, setRequestSummary] = useState("");

  useEffect(() => {
    if (!open) return;
    setMode("existing");
    setSelectedGuideIds([]);
    setSelectedTargetIds([]);
    setRequestTitle("");
    setRequestSummary("");
  }, [open]);

  // g.id is the guide base id
  const availableGuides = guides.filter(
    (g): g is GuideListItem & { slug: string } =>
      !!g.slug && !existingGuideBaseIds.includes(g.id)
  );

  const guideItems = availableGuides.map((g) => ({
    value: g.id,
    label: g.title ?? g.slug,
    description: g.summary ?? undefined,
  }));

  const title = requestTitle.trim();
  const summary = requestSummary.trim();

  const selectedBaseIds =
    mode === "target" ? selectedTargetIds : selectedGuideIds;

  const canAdd =
    mode === "request"
      ? title.length > 0 && summary.length > 0
      : selectedBaseIds.length > 0;

  const chosenNodes = (): Array<ObjectiveGraphNode> => {
    if (mode === "request") {
      return [
        { id: crypto.randomUUID(), type: "guide_request", title, summary },
      ];
    }

    return availableGuides
      .filter((g) => selectedBaseIds.includes(g.id))
      .map((g) => ({
        id: crypto.randomUUID(),
        type: mode === "target" ? "target" : "guide",
        guideBaseId: g.id,
        guideSlug: g.slug,
        title: g.title ?? g.slug,
      }));
  };

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd(chosenNodes());
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
            Add a Guide
          </DialogTitle>

          <DialogDescription className="text-xs text-muted-foreground">
            Add existing guides or target guides to the objective, or request
            one that does not exist yet.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={mode}
          onValueChange={(value) => setMode(value as Mode)}
          className="p-6"
        >
          <TabsList>
            <TabsTrigger value="existing">Existing guide</TabsTrigger>
            <TabsTrigger value="target">Target guide</TabsTrigger>
            <TabsTrigger value="request">Request a guide</TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="pt-4">
            {/* ponytail: modal popover eats the first tab click while open; upgrade when ui/combobox scrolls without modal */}
            <Combobox
              multiple
              items={guideItems}
              value={selectedGuideIds}
              onValueChange={setSelectedGuideIds}
              modal
            />
          </TabsContent>

          <TabsContent value="target" className="space-y-2 pt-4">
            <p className="text-xs text-muted-foreground">
              A target is a guide the objective leads to. Its prerequisites are
              added with it.
            </p>
            <Combobox
              multiple
              items={guideItems}
              value={selectedTargetIds}
              onValueChange={setSelectedTargetIds}
              modal
            />
          </TabsContent>

          <TabsContent value="request" className="space-y-4 pt-4">
            <div className="space-y-2">
              <FieldLabel htmlFor="guide-request-title" required>
                Title
              </FieldLabel>
              <Input
                id="guide-request-title"
                value={requestTitle}
                onChange={(e) => setRequestTitle(e.target.value)}
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <FieldLabel htmlFor="guide-request-summary" required>
                Summary
              </FieldLabel>
              <Textarea
                id="guide-request-summary"
                value={requestSummary}
                onChange={(e) => setRequestSummary(e.target.value)}
                maxLength={500}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="p-5 pt-0">
          <DialogClose asChild>
            <Button variant="outline" size="lg" className="btn-sec">
              Cancel
            </Button>
          </DialogClose>
          <Button
            size="lg"
            className="btn-pri"
            onClick={handleAdd}
            disabled={!canAdd}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
