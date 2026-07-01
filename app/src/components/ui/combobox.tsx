"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type ComboboxBaseProps = {
  items: Array<string>
  placeholder?: string
}

type SingleProps = ComboboxBaseProps & {
  multiple?: false
  value: string
  onValueChange: (value: string) => void
}

type MultiProps = ComboboxBaseProps & {
  multiple: true
  value: Array<string>
  onValueChange: (value: Array<string>) => void
}

type ComboboxProps = SingleProps | MultiProps

export function Combobox({ multiple, items, value, onValueChange }: ComboboxProps) {
  const [open, setOpen] = React.useState(false)

  const isMulti = multiple === true

  const selected = isMulti
    ? value
    : value
      ? [value]
      : []

  const toggle = (item: string) => {
    if (!isMulti) {
      onValueChange(item)
      setOpen(false)
      return
    }

    const exists = value.includes(item)

    onValueChange(
      exists
        ? value.filter((v) => v !== item)
        : [...value, item]
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-[300px] justify-between">
          <div className="flex gap-1 flex-wrap">
            {selected.length === 0 && (
              <span className="text-muted-foreground">Select...</span>
            )}

            {isMulti ? (
              selected.map((v) => (
                <span
                  key={v}
                  className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs"
                >
                  {v}
                </span>
              ))
            ) : (
              <span>{selected[0]}</span>
            )}
          </div>

          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>

            <CommandGroup>
              {items.map((item) => {
                const isSelected = selected.includes(item)

                return (
                  <CommandItem
                    key={item}
                    value={item}
                    onSelect={() => toggle(item)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {item}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}