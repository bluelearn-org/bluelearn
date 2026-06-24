import { createFileRoute } from "@tanstack/react-router"

import { Separator } from "@/components/ui/separator"
import ContributionFlow from "@/components/contribute/ContributionFlow"


export const Route = createFileRoute("/contribute")({ component: RouteComponent })

function RouteComponent() {
  return (
    <div className="mx-auto max-w-[1280px] border-x bg-background">
      <section className="border-b px-8 py-8 lg:px-16">
        <div className="mb-6">
          <h1 className="data-label text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            Contribute a Guide
          </h1>
        </div>

        <Separator className="mb-8 bg-border" />

        <ContributionFlow />

        </section>
    </div>
  )
}