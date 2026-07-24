import { Handle, Position } from "@xyflow/react";
import { Checkbox } from "@/components/ui/checkbox";

export function CurationNode({ data }: { data: any }) {
  const { isTarget, isChecked, title, selectedOrder, isHovered, isDimmed } =
    data;

  return (
    <div
      className={`relative flex max-w-[350px] min-w-[300px] flex-col gap-2 rounded-xl border-2 bg-card p-3 transition-all duration-150 select-none ${
        isHovered
          ? "z-10 scale-105 border-primary shadow-md ring-4 ring-primary/40"
          : ""
      } ${isDimmed ? "opacity-30" : ""} ${
        isTarget
          ? "cursor-default border-primary shadow-sm"
          : isChecked
            ? "cursor-pointer border-primary/50 shadow-sm hover:border-primary"
            : "cursor-pointer border-border shadow-sm hover:border-primary/30"
      }`}
    >
      <Handle
        type="source"
        position={Position.Top}
        className="-top-1 h-2 w-8 rounded-full !border-none !bg-primary/40"
      />

      <div className="flex items-center gap-3">
        <Checkbox
          checked={isChecked}
          disabled={isTarget}
          className="pointer-events-none"
        />
        <div className="min-w-0 flex-1">
          <h4 className="flex flex-col gap-1 text-sm font-semibold text-foreground">
            {title}
            {isTarget && (
              <span className="self-start rounded bg-primary/20 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-primary uppercase">
                Target
              </span>
            )}
          </h4>
        </div>
      </div>

      {selectedOrder !== undefined && selectedOrder !== null && (
        <div className="absolute -top-3 -right-3 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-md ring-4 shadow-primary/30 ring-card">
          {selectedOrder}
        </div>
      )}

      <Handle
        type="target"
        position={Position.Bottom}
        className="-bottom-1 h-2 w-8 rounded-full !border-none !bg-primary/40"
      />
    </div>
  );
}
