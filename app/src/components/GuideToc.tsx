import { useMemo } from "react";
import { List } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { extractHeadings } from "@/lib/guideUtils";

export function GuideToc({ body }: { body: string }) {
  const headings = useMemo(() => extractHeadings(body), [body]);

  if (headings.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Table of contents"
          className="-mt-0.5 -ml-1 h-9 w-9 shrink-0 rounded-md md:hidden"
        >
          <List className="size-6" strokeWidth={2.5} />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="max-h-[60vh] w-64 overflow-y-auto p-0"
      >
        <p className="editorial-heading border-b px-4 pt-4 pb-3.5 text-lg leading-none">
          Table of Contents
        </p>

        <ul className="space-y-2.5 px-4 pb-4">
          {headings.map((h, idx) => (
            <li
              key={idx}
              className="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
              style={{
                paddingLeft:
                  h.level === 1
                    ? 6
                    : h.level === 2
                      ? 12
                      : h.level === 3
                        ? 24
                        : 28,
              }}
            >
              <a href={`#${h.id}`} className="block w-full py-1">
                {h.text}
              </a>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
