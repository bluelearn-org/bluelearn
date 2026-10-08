import { useId } from "react";

import type { GraphOrientation } from "@/lib/graphOrientation";
import {
  GRAPH_ORIENTATION_OPTIONS,
  isGraphOrientation,
} from "@/lib/graphOrientation";
import { GRAPH_ORIENTATION_ICONS } from "@/components/graph/graphOrientationIcons";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type GraphOrientationControlProps = {
  orientation: GraphOrientation;
  onChange: (orientation: GraphOrientation) => void;
};

// Re-orients the graph it sits on without touching the reader's default.
export function GraphOrientationControl({
  orientation,
  onChange,
}: GraphOrientationControlProps) {
  const radioId = useId();
  const Icon = GRAPH_ORIENTATION_ICONS[orientation];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 border-border/50 bg-background/80 shadow-sm backdrop-blur-md"
          title="Graph orientation"
          aria-label="Graph orientation"
        >
          <Icon />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        aria-label="Graph orientation"
        className="w-56 gap-3"
      >
        <div className="text-xs font-medium">Graph orientation</div>

        <RadioGroup
          aria-label="Graph orientation"
          className="flex flex-col gap-0.5"
          value={orientation}
          onValueChange={(value) => {
            if (isGraphOrientation(value)) {
              onChange(value);
            }
          }}
        >
          {GRAPH_ORIENTATION_OPTIONS.map((option) => (
            <div
              key={option.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 hover:bg-muted"
            >
              <RadioGroupItem
                id={`${radioId}-${option.id}`}
                value={option.id}
              />
              <Label
                htmlFor={`${radioId}-${option.id}`}
                className="flex-1 cursor-pointer"
              >
                {option.label}
              </Label>
            </div>
          ))}
        </RadioGroup>

        <p className="text-xs text-muted-foreground">
          Applies to this view. Set a default under Settings → Appearance.
        </p>
      </PopoverContent>
    </Popover>
  );
}
