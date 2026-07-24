import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";

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
  className?: string;
  disabled?: boolean;
};

type SingleProps = ComboboxBaseProps & {
  multiple?: false;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
};

type MultiProps = ComboboxBaseProps & {
  multiple: true;
  value: Array<string>;
  onValueChange: (value: Array<string>) => void;
  disabled?: boolean;
};

type ComboboxProps = SingleProps | MultiProps;

export function Combobox({
  multiple,
  items,
  value,
  onValueChange,
  className,
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-75 justify-between", className)}
          disabled={disabled}
        >
          <div className="flex flex-wrap gap-1">
            {selected.length === 0 && (
              <span className="text-muted-foreground">Select...</span>
            )}

            {isMulti ? (
              selectedItems.map((item) => (
                <span
                  key={item.value}
                  className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs"
                >
                  {item.label}
                </span>
              ))
            ) : (
              <span>{selectedItems[0]?.label}</span>
            )}
          </div>

          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-125 p-0">
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
  );
}
