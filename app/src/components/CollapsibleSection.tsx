import { ChevronDown } from "lucide-react"

export const CollapsibleSection = ({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) => {
  return (
    <details className="group border-b py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between data-label">
        {title}
        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-4 space-y-2 text-sm">{children}</div>
    </details>
  )
}