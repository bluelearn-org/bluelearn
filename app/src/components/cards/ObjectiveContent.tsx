import { ArrowRight } from "lucide-react";

import type { Guide } from "@/types/guides";

import { CardContent } from "@/components/ui/card";

type PropTypes = {
  guides: Array<Guide>;
};

export const ObjectiveContent = ({ guides }: PropTypes) => {
  return (
    <CardContent className="space-y-2 border-t p-4">
      <div className="flex items-center justify-between gap-4">
        {guides.map((guide, index) => (
          <div
            key={guide.slug}
            className="flex min-w-0 flex-1 items-center gap-2"
          >
            <div className="flex flex-col items-center justify-center">
              <p className="flex h-8 w-8 items-center justify-center rounded-full bg-badge px-2 text-xl">
                {guide.order}
              </p>

              <p className="line-clamp-4 py-2 text-center text-sm">
                {guide.title}
              </p>
            </div>

            {(index < guides.length - 1 || guides.length >= 3) && (
              <ArrowRight className="h-5 w-5 shrink-0" />
            )}
            {index >= guides.length - 1 && (
              <div className="text-center">
                <p>{guides.length - 3}</p>

                <p className="text-xs text-muted-foreground">more guides</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </CardContent>
  );
};
