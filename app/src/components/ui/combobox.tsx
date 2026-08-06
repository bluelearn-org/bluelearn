import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type ComboboxItem = {
  value: string;
  label: string;
  description?: string;
};

type ComboboxBaseProps = {
  items: Array<ComboboxItem>;
  placeholder?: string;
  disabled?: boolean;
};

type SingleProps = ComboboxBaseProps & {
  multiple?: false;
  value: string;
  onValueChange: (value: string) => void;
};

type MultiProps = ComboboxBaseProps & {
  multiple: true;
  value: Array<string>;
  onValueChange: (value: Array<string>) => void;
};

type ComboboxProps = SingleProps | MultiProps;

export function Combobox({
  multiple,
  items,
  value,
  onValueChange,
  disabled,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const isMulti = multiple === true;

  const selected = isMulti ? value : value ? [value] : [];

  const toggle = (itemValue: string) => {
    if (!isMulti) {
      onValueChange(itemValue);
      setOpen(false);
      return;
    }

    const exists = value.includes(itemValue);

    onValueChange(
      exists ? value.filter((v) => v !== itemValue) : [...value, itemValue]
    );
  };

  const selectedItems = items.filter((item) => selected.includes(item.value));

  return (
    <div className="space-y-2">
      <Popover modal={true} open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between"
            disabled={disabled}
          >
            {isMulti || selected.length === 0 ? (
              <span className="text-muted-foreground">Select...</span>
            ) : (
              <span>{selectedItems[0]?.label}</span>
            )}

            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
          <Command>
            <CommandInput placeholder="Search..." />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>

              <CommandGroup>
                {items.map((item) => {
                  const isSelected = selected.includes(item.value);

                  return (
                    <CommandItem
                      key={item.value}
                      className="cursor-pointer"
                      value={item.label} // searchable text
                      onSelect={() => toggle(item.value)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span>{item.label}</span>

                        {item.description && (
                          <span className="text-xs text-muted-foreground">
                            {item.description}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {isMulti && selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          {selectedItems.map((item) => (
            <Badge key={item.value} variant="outline" className="gap-1.5">
              {item.label}
              <button
                type="button"
                aria-label={`Remove ${item.label}`}
                className="text-muted-foreground hover:text-foreground"
                onClick={() => toggle(item.value)}
              >
                <X className="size-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
