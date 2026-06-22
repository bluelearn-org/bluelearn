import { useState } from "react"
import { ChevronRight } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

export const CollapsibleSection = ({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) => {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b py-4 group">
      <CollapsibleTrigger asChild>
        <button className="flex w-full cursor-pointer list-none items-center justify-between data-label">
          <ChevronRight
            className={`h-4 w-4 transition-transform ${
              open ? "rotate-90" : ""
            }`}
          />
          {title}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-4 space-y-2 text-sm">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}