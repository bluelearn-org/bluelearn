import type { HydratedPath } from "@/types/paths";

import { Separator } from "@/components/ui/separator";
import { PathCard } from "@/components/cards/PathCard";

type PropTypes = {
  paths: Array<HydratedPath>;
  type: string;
};

export const FeaturedRow = ({ paths, type }: PropTypes) => {
  return (
    <section className="border-b px-8 py-10 lg:px-16">
      {/* Header */}
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="data-label text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
            {type}
          </p>
        </div>
      </div>

      <Separator className="mb-4 bg-border" />

      {/* Paths */}
      <div className="flex scrollbar-thin gap-6 overflow-x-auto p-2">
        {paths.map((path: HydratedPath) => (
          <div key={path.slug} className="w-[550px] shrink-0">
            <PathCard key={path.slug} path={path} />
          </div>
        ))}
      </div>
    </section>
  );
};
