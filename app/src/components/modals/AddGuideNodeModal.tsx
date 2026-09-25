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

type Mode = "existing" | "prerequisites" | "request";

type PropTypes = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guides: Array<GuideListItem>;
  existingGuideBaseIds: Array<string>;
  // pullPrerequisitesFor names guide base ids whose prerequisites come along.
  onAdd: (
    nodes: Array<ObjectiveGraphNode>,
    options?: { pullPrerequisitesFor: Array<string> }
  ) => void;
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
  const [selectedWithPrereqIds, setSelectedWithPrereqIds] = useState<
    Array<string>
  >([]);
  const [requestTitle, setRequestTitle] = useState("");
  const [requestSummary, setRequestSummary] = useState("");

  useEffect(() => {
    if (!open) return;
    setMode("existing");
    setSelectedGuideIds([]);
    setSelectedWithPrereqIds([]);
    setRequestTitle("");
    setRequestSummary("");
  }, [open]);

  // g.id is the guide base id
  const availableGuides = guides.filter(
    (g): g is GuideListItem & { slug: string } =>
      !!g.slug && !existingGuideBaseIds.includes(g.id)
  );

  // A guide picked on one tab leaves the other's list, so it lands once.
  const guideItems = (pickedOnOtherTab: Array<string>) =>
    availableGuides
      .filter((g) => !pickedOnOtherTab.includes(g.id))
      .map((g) => ({
        value: g.id,
        label: g.title ?? g.slug,
        description: g.summary ?? undefined,
      }));

  const title = requestTitle.trim();
  const summary = requestSummary.trim();

  const requestStarted = title.length > 0 || summary.length > 0;
  const requestComplete = title.length > 0 && summary.length > 0;
  const pickCount = selectedGuideIds.length + selectedWithPrereqIds.length;

  // A half-typed request blocks Add rather than being dropped from the batch.
  const canAdd = requestStarted ? requestComplete : pickCount > 0;

  const pickedNodes = (baseIds: Array<string>): Array<ObjectiveGraphNode> =>
    availableGuides
      .filter((g) => baseIds.includes(g.id))
      .map((g) => ({
        id: crypto.randomUUID(),
        type: "guide" as const,
        guideBaseId: g.id,
        guideSlug: g.slug,
        title: g.title ?? g.slug,
      }));

  const chosenNodes = (): Array<ObjectiveGraphNode> => [
    ...pickedNodes(selectedGuideIds),
    ...pickedNodes(selectedWithPrereqIds),
    ...(requestComplete
      ? [
          {
            id: crypto.randomUUID(),
            type: "guide_request" as const,
            title,
            summary,
          },
        ]
      : []),
  ];

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd(chosenNodes(), { pullPrerequisitesFor: selectedWithPrereqIds });
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
            Add existing guides to the objective, with or without their
            prerequisites, or request one that does not exist yet.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={mode}
          onValueChange={(value) => setMode(value as Mode)}
          className="p-6"
        >
          <TabsList>
            <TabsTrigger value="existing">Existing guide</TabsTrigger>
            <TabsTrigger value="prerequisites">
              Guide with prerequisites
            </TabsTrigger>
            <TabsTrigger value="request">Request a guide</TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="pt-4">
            {/* enough: modal popover eats the first tab click while open; upgrade when ui/combobox scrolls without modal */}
            <Combobox
              multiple
              items={guideItems(selectedWithPrereqIds)}
              value={selectedGuideIds}
              onValueChange={setSelectedGuideIds}
              modal
            />
          </TabsContent>

          <TabsContent value="prerequisites" className="space-y-2 pt-4">
            <p className="text-xs text-muted-foreground">
              The guide's prerequisites are added with it.
            </p>
            <Combobox
              multiple
              items={guideItems(selectedGuideIds)}
              value={selectedWithPrereqIds}
              onValueChange={setSelectedWithPrereqIds}
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
