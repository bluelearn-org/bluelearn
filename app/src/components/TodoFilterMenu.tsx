import { useEffect, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";

import type { TodoFilters } from "@/lib/todoFilters";
import type { ComboboxItem } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Combobox } from "@/components/ui/combobox";

type TodoFilterMenuProps = {
  q?: string;
  subject?: string;
  objective?: string;
  subjectItems: Array<ComboboxItem>;
  objectiveItems: Array<ComboboxItem>;
  onChange: (filters: Partial<TodoFilters>) => void;
};

export function TodoFilterMenu({
  q,
  subject,
  objective,
  subjectItems,
  objectiveItems,
  onChange,
}: TodoFilterMenuProps) {
  const [name, setName] = useState(q ?? "");
  const [open, setOpen] = useState(false);

  // Keep the local field in sync with the URL so back/forward updates it.
  useEffect(() => setName(q ?? ""), [q]);

  const active = Boolean(q || subject || objective);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Filter todo guides"
          className={`h-9 w-9 shrink-0 rounded-md border ${active ? "text-brand-bright-blue" : ""}`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="font-mono">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onChange({ q: name.trim() || undefined });
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Filter by name"
            aria-label="Filter todo guides by name"
            className="h-9 flex-1"
          />
          <Button
            type="submit"
            size="icon"
            aria-label="Apply name filter"
            className="btn-pri h-9 w-9 shrink-0 rounded-md"
          >
            <Search className="h-3.5 w-3.5" />
          </Button>
        </form>

        <div className="flex flex-col gap-1.5">
          <span className="data-label">Subject</span>
          <Combobox
            items={subjectItems}
            value={subject ?? ""}
            onValueChange={(value) => onChange({ subject: value || undefined })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="data-label">Objective</span>
          <Combobox
            items={objectiveItems}
            value={objective ?? ""}
            onValueChange={(value) =>
              onChange({ objective: value || undefined })
            }
          />
        </div>

        {active && (
          <Button
            type="button"
            variant="ghost"
            className="h-9 justify-center self-end rounded-md border border-border bg-muted"
            onClick={() =>
              onChange({
                q: undefined,
                subject: undefined,
                objective: undefined,
              })
            }
          >
            Reset filters
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
