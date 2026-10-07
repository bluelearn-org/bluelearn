import { useId } from "react";

import {
  GRAPH_ORIENTATION_OPTIONS,
  isGraphOrientation,
  useGraphOrientation,
} from "@/lib/graphOrientation";
import { cn } from "@/lib/utils";
import { GRAPH_ORIENTATION_ICONS } from "@/components/graph/graphOrientationIcons";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// Settings control for the orientation every graph opens with.
export function GraphOrientationSelector() {
  const { orientation, setOrientation } = useGraphOrientation();
  const radioId = useId();

  return (
    <RadioGroup
      aria-label="Default graph orientation"
      className="grid grid-cols-1 gap-3 md:grid-cols-2"
      value={orientation}
      onValueChange={(value) => {
        if (isGraphOrientation(value)) setOrientation(value);
      }}
    >
      {GRAPH_ORIENTATION_OPTIONS.map((option) => {
        const Icon = GRAPH_ORIENTATION_ICONS[option.id];
        const selected = orientation === option.id;
        const id = `${radioId}-${option.id}`;

        return (
          <label
            key={option.id}
            htmlFor={id}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-md border bg-card p-4 transition-colors hover:border-primary",
              selected && "border-primary ring-2 ring-primary/20"
            )}
          >
            <RadioGroupItem id={id} value={option.id} className="mt-1" />
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
              <Icon className="size-4" />
            </span>
            <span className="flex flex-col gap-1">
              <span className="font-medium">{option.label}</span>
              <span className="text-sm text-muted-foreground">
                {option.description}
              </span>
            </span>
          </label>
        );
      })}
    </RadioGroup>
  );
}
