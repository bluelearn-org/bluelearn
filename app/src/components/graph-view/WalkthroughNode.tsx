import { Handle, Position } from "@xyflow/react";
import { Clock, Network } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function WalkthroughNode({ data }: { data: any }) {
  const {
    isTarget,
    title,
    summary,
    duration,
    tags,
    level,
    isHovered,
    isDimmed,
  } = data;

  return (
    <div
      className={`relative max-w-[420px] min-w-[380px] transition-all duration-150 select-none ${
        isHovered ? "z-10 scale-[1.02]" : ""
      } ${isDimmed ? "opacity-30" : ""}`}
    >
      <Handle
        type="source"
        position={Position.Top}
        className="-top-1 h-2 w-8 rounded-full !border-none !bg-primary/40"
      />

      <Card
        className={`group relative rounded-md bg-background shadow-none transition-colors hover:bg-muted ${
          isHovered ? "border-primary ring-2 ring-primary/20" : "border-border"
        } ${isTarget ? "border-primary/50 shadow-sm" : ""}`}
      >
        {/* Header */}
        <CardHeader className="relative p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
              Guide
            </p>
            {isTarget && (
              <Badge
                variant="outline"
                className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
              >
                Target
              </Badge>
            )}
          </div>

          <h3 className="line-clamp-2 text-base font-semibold tracking-tight">
            {title}
          </h3>

          <div className="flex items-center gap-3 pt-1.5 text-xs">
            {duration !== undefined && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                {duration} min
              </div>
            )}
            {level !== undefined && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Network className="h-3 w-3" />
                Level {level}
              </div>
            )}
          </div>
        </CardHeader>

        {/* Metadata */}
        {(summary || (tags && tags.length > 0)) && (
          <CardContent className="border-t p-3">
            {summary && (
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {summary}
              </p>
            )}

            {tags && tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {tags.map((tag: any) => (
                  <Badge
                    key={typeof tag === "string" ? tag : tag.slug}
                    variant="outline"
                    className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
                  >
                    {typeof tag === "string" ? tag : tag.name || tag.slug}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <Handle
        type="target"
        position={Position.Bottom}
        className="-bottom-1 h-2 w-8 rounded-full !border-none !bg-primary/40"
      />
    </div>
  );
}
