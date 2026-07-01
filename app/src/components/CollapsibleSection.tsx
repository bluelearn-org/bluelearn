import { useState } from "react"
import { ChevronRight } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

export const CollapsibleSection = ({
  title,
  defaultOpen,
  children,
}: {
  title: React.ReactNode,
  defaultOpen?: boolean,
  children: React.ReactNode
}) => {
  const [open, setOpen] = useState(defaultOpen ?? false)

  return (
    <Collapsible defaultOpen={defaultOpen} open={open} onOpenChange={setOpen} className="border-b py-4 group">
      <CollapsibleTrigger asChild>
        <div className="flex w-full cursor-pointer list-none items-center data-label">
          <ChevronRight
            className={`h-4 w-4 transition-transform ${
              open ? "rotate-90" : ""
            }`}
          />
          {title}
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-4 space-y-2 text-sm">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}