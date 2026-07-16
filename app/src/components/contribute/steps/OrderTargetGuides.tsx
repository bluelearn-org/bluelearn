import { useRef, useState } from "react";
import { Replace } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { ObjectiveContribution } from "@/types/contributions";
import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";
import { FieldGroup } from "@/components/ui/field";
import guidesData from "@/data/blueguides.json";
import { Button } from "@/components/ui/button";
import { DraggableGuideCard } from "@/components/contribute/DraggableGuideCard";

const guidesMap = new Map(guidesData.map((g) => [g.slug, g]));

type PropTypes = {
  Stepper: any;
  objectiveContData: ObjectiveContribution;
  setObjectiveContData: Dispatch<SetStateAction<ObjectiveContribution>>;
};

export const OrderTargetGuides = ({
  Stepper,
  objectiveContData,
  setObjectiveContData,
}: PropTypes) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const draggedIndexRef = useRef<number | null>(null);

  const targets = objectiveContData.targets;

  const handleDragStart = (e: React.DragEvent, index: number) => {
    draggedIndexRef.current = index;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const currentDragged = draggedIndexRef.current;
    if (currentDragged === null || currentDragged === index) return;

    const newTargets = [...targets];
    const draggedItem = newTargets[currentDragged];
    if (!draggedItem) return;
    newTargets.splice(currentDragged, 1);
    newTargets.splice(index, 0, draggedItem);

    setObjectiveContData((prev) => ({ ...prev, targets: newTargets }));

    draggedIndexRef.current = index;
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    draggedIndexRef.current = null;
    setDraggedIndex(null);
  };

  return (
    <Stepper.Content step="target-ordering">
      <StepperActionHeader title={"Order Target Guides"} Stepper={Stepper} />

      <FieldGroup className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Drag and drop to specify the order in which these target guides should
          be completed.
        </p>

        <div className="space-y-3">
          {targets.map((slug, index) => {
            const guide = guidesMap.get(slug);
            if (!guide) return null;

            const isDragging = index === draggedIndex;

            return (
              <DraggableGuideCard
                key={index}
                guide={guide}
                index={index}
                isDragging={isDragging}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  disabled
                  className="h-8 w-8 cursor-not-allowed border-none p-0 text-muted-foreground/40 hover:bg-transparent"
                  title="Variants Coming Soon"
                >
                  <Replace className="h-5 w-5" />
                </Button>
              </DraggableGuideCard>
            );
          })}
        </div>
      </FieldGroup>
    </Stepper.Content>
  );
};
