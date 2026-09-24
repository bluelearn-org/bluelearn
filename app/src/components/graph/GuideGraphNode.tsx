import { Handle, Position } from "@xyflow/react";
import type { ReactNode } from "react";
import { Card, CardHeader } from "@/components/ui/card";

// The walkthrough's GraphNodeData satisfies this as is; the design canvas has
// no level or duration, so the footer waits for both.
export type GuideGraphNodeData = {
  title: string;
  summary?: string | null;
  level?: number;
  duration_minutes?: number;
  isTarget: boolean;
  isHovered: boolean;
  isDimmed: boolean;
};

type GuideGraphNodeProps = {
  data: GuideGraphNodeData;
  isSelected: boolean;
  // Sits left of the title, for per-graph controls like the curation checkbox.
  leading?: ReactNode;
  // Floats over the card's top-right corner.
  badge?: ReactNode;
  // A guide the design canvas asks for but nobody has written yet.
  isRequest?: boolean;
  // The design canvas connects through these, flipped so prerequisites sit below.
  handles?: { target: Position; source: Position; className: string };
  // The design canvas lays out a fixed column (OBJECTIVE_NODE_WIDTH).
  fixedWidth?: boolean;
  // The design canvas's hover is a focus: the card glows while its
  // prerequisites and follow-ups light up. The walkthrough and curation keep
  // the plain tint.
  focusOnHover?: boolean;
};

export function GuideGraphNode({
  data,
  isSelected,
  leading,
  badge,
  isRequest = false,
  handles,
  fixedWidth = false,
  focusOnHover = false,
}: GuideGraphNodeProps) {
  const {
    isTarget,
    title,
    summary,
    duration_minutes,
    level,
    isHovered,
    isDimmed,
  } = data;

  // The target inverts, so its dividers and labels ride on the fill instead of
  // the page.
  const divider = isTarget ? "border-white/25" : "border-border";
  const label = isTarget ? "text-white/70" : "text-muted-foreground";

  let kind = "Guide";
  if (isTarget) kind = "Target Guide";
  if (isRequest) kind = "Guide request";

  let border = isSelected ? "border-brand-bright-blue" : "border-foreground";
  if (isRequest) border = "border-dashed border-foreground/60";

  const width = fixedWidth ? "w-[260px]" : "w-max min-w-[260px]";
  const titleWrap = fixedWidth ? "" : "whitespace-nowrap";
  const glow =
    focusOnHover && isHovered
      ? "ring-2 ring-brand-bright-blue shadow-[0_0_16px_0] shadow-brand-bright-blue/40"
      : "";

  return (
    <div
      className={`relative ${width} cursor-pointer transition-opacity duration-150 select-none ${
        isDimmed ? "opacity-30" : ""
      }`}
    >
      <Card
        className={`group relative gap-0 rounded-md border py-0 ring-0 transition-colors ${
          isTarget
            ? isHovered
              ? "bg-brand-dark-navy/90 text-white"
              : "bg-brand-dark-navy text-white"
            : isHovered || isSelected
              ? "bg-muted"
              : "bg-background"
        } ${border} ${glow}`}
      >
        <CardHeader className="[container-type:normal] gap-1 py-3.5">
          <div className="flex items-start gap-3">
            {leading}
            <div>
              <p className={`mono-micro ${label}`}>{kind}</p>
              <h3
                className={`text-lg font-semibold tracking-tight ${titleWrap}`}
              >
                {title}
              </h3>
              {isRequest && summary && (
                <p className="text-sm text-muted-foreground">{summary}</p>
              )}
            </div>
          </div>
        </CardHeader>

        {level !== undefined && duration_minutes !== undefined && (
          <div className={`grid grid-cols-2 border-t ${divider}`}>
            <div className={`border-r px-4 py-2.5 ${divider}`}>
              <p className={`mono-micro ${label}`}>Level</p>
              <p className="text-sm font-semibold">{level}</p>
            </div>
            <div className="px-4 py-2.5">
              <p className={`mono-micro ${label}`}>Duration</p>
              <p className="text-sm font-semibold">
                {duration_minutes > 0 ? `${duration_minutes} min` : "--"}
              </p>
            </div>
          </div>
        )}
      </Card>

      {badge}

      {/* After the Card, so the handles paint over it and stay clickable. */}
      <Handle
        type="target"
        position={handles?.target ?? Position.Bottom}
        className={
          handles?.className ??
          "-bottom-1 h-2 w-8 rounded-full !border-none !bg-primary/40"
        }
      />

      <Handle
        type="source"
        position={handles?.source ?? Position.Top}
        className={
          handles?.className ??
          "-top-1 h-2 w-8 rounded-full !border-none !bg-primary/40"
        }
      />
    </div>
  );
}
