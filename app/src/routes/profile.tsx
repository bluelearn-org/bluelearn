import { createFileRoute } from "@tanstack/react-router"
import { ChevronDown } from "lucide-react"
import { Circle } from "@/components/ui/circle"
import { PathContributionCard } from "@/components/cards/PathContributionCard"

import stats from "@/data/stats.json"
import pathContributions from "@/data/pathContributions.json"

export const Route = createFileRoute("/profile")({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="mx-auto max-w-7xl border-x bg-background">
      <section className="border-b px-8 py-10 lg:px-16">
        <div className="mb-6 flex flex-col items-center justify-center">
          <Circle
            name="Garvin Smith"
            size={140}
            className="font-bold text-black"
          />
          <h2 className="mt-2 text-2xl font-bold">John_Doe99</h2>

          <h3 className="mb-3 text-gray-500">Admin</h3>

          {/* <Separator className="mb-4 bg-border" /> */}
        </div>
      </section>
      <section className="border-b px-8 py-10 lg:px-16">
        <div className="flex flex-col">
          <h2 className="mb-6 flex items-center gap-2 border-b border-black pb-3 text-lg font-bold">
            <ChevronDown size={20} />
            STATS
          </h2>
          <div className="border border-black p-8">
            <div className="flex items-center justify-around">
              {stats.map((stat) => (
                <div key={stat.number} className="flex flex-col items-center">
                  <Circle content={stat.number} name=""size={130}/>
                  <h3 className="mt-4 font-semibold">{stat.title}</h3>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="border-b px-8 py-10 lg:px-16">
        <div className="flex flex-col">
          <h2 className="mb-6 flex items-center gap-2 border-b border-black pb-3 text-lg font-bold">
            <ChevronDown size={20} />
            CONTRIBUTIONS (6)
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {pathContributions.map((contribution) => (
              <PathContributionCard key={contribution.path_id} contribution={contribution} />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
