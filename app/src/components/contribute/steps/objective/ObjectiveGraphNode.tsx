import { Handle, Position } from "@xyflow/react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Matches the frame's w-[260px], so the layout centres what is drawn.
export const OBJECTIVE_NODE_WIDTH = 260;

export type ObjectiveNodeData = {
  title: string;
  summary?: string;
  isTarget: boolean;
};

type ObjectiveNodeProps = {
  data: ObjectiveNodeData;
};

const CARD_CLASS = "gap-0 rounded-md border bg-background py-0 ring-0";

const HANDLE_CLASS =
  "!h-3 !w-12 !cursor-crosshair rounded-full !border-none !bg-primary/70 transition-[scale,background-color] hover:scale-125 hover:!bg-primary";

export function ObjectiveGuideNode({ data }: ObjectiveNodeProps) {
  return (
    <NodeFrame>
      <Card className={cn(CARD_CLASS, "border-foreground")}>
        <CardHeader className="[container-type:normal] gap-1 py-3.5">
          {data.isTarget && <Badge>Target</Badge>}
          <h3 className="text-lg font-semibold tracking-tight">{data.title}</h3>
        </CardHeader>
      </Card>
    </NodeFrame>
  );
}

export function ObjectiveRequestNode({ data }: ObjectiveNodeProps) {
  return (
    <NodeFrame>
      <Card className={cn(CARD_CLASS, "border-dashed border-foreground/60")}>
        <CardHeader className="[container-type:normal] gap-1 py-3.5">
          <p className="mono-micro text-muted-foreground">Guide request</p>
          <h3 className="text-lg font-semibold tracking-tight">{data.title}</h3>
          {data.summary && (
            <p className="text-sm text-muted-foreground">{data.summary}</p>
          )}
        </CardHeader>
      </Card>
    </NodeFrame>
  );
}

function NodeFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative w-[260px] select-none">
      <Handle type="target" position={Position.Top} className={HANDLE_CLASS} />
      {children}
      <Handle
        type="source"
        position={Position.Bottom}
        className={HANDLE_CLASS}
      />
    </div>
  );
}
