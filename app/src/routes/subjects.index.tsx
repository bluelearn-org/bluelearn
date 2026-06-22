import { createFileRoute } from "@tanstack/react-router"

import type { Subject } from "@/types/subjects"

import { Separator } from "@/components/ui/separator"

import { SubjectCard } from "@/components/cards/SubjectCard"
import subjects from "@/data/subjects.json"

export const Route = createFileRoute("/subjects/")({ component: RouteComponent })

function RouteComponent() {
  return (
    <div className="mx-auto max-w-[1280px] border-x bg-background">
      <section className="border-b px-8 py-8 lg:px-16">
        <div className="mb-6">
          <h1 className="data-label text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            Browse By Subjects
          </h1>
        </div>
        
        <Separator className="mb-4 bg-border" />

        {/* Grid */}
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
          {subjects.map((subject: Subject) => (
            <SubjectCard key={subject.slug} subject={subject} />
          ))}
        </div>
      </section>
    </div>
  )
}
