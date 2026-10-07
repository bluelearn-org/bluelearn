import type { ScopeOption } from "@/lib/walkthroughScope";
import { cn } from "@/lib/utils";

type WalkthroughScopeProps = {
  options: ReadonlyArray<ScopeOption>;
  // The selected subject slug; null reads every prerequisite.
  value: string | null;
  onChange: (slug: string | null) => void;
  floorCount: number;
};

// Scope chips above the walkthrough. Hidden when the target carries no
// subject, since there is then nothing to scope by.
export function WalkthroughScope({
  options,
  value,
  onChange,
  floorCount,
}: WalkthroughScopeProps) {
  if (options.length <= 1) return null;

  const current = options.find((option) => option.slug === value) ?? null;

  return (
    <div className="mb-4 space-y-2">
      <div
        role="radiogroup"
        aria-label="Walkthrough scope"
        className="flex flex-wrap items-center gap-2"
      >
        {options.map((option) => {
          const active = option.slug === value;
          return (
            <button
              key={option.slug ?? "all"}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option.slug)}
              className={cn(
                "mono-micro rounded-full border px-3 py-1 tracking-[0.08em] transition-colors",
                active
                  ? "border-brand-bright-blue bg-brand-bright-blue text-white"
                  : "border-badge-border bg-badge text-badge-foreground hover:border-foreground"
              )}
            >
              {option.name}
            </button>
          );
        })}
      </div>

      {current?.slug && (
        <p className="text-xs text-muted-foreground">
          {floorCount > 0
            ? `Scoped to ${current.name}: ${floorCount} ${
                floorCount === 1 ? "guide" : "guides"
              } in its prerequisite floor ${
                floorCount === 1 ? "is" : "are"
              } shown as assumed knowledge and not expanded.`
            : `Scoped to ${current.name}. This subject has no prerequisite floor yet, so every prerequisite is shown.`}
        </p>
      )}
    </div>
  );
}
