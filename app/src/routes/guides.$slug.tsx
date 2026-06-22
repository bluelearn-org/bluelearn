import { createFileRoute, notFound } from "@tanstack/react-router"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useMemo } from "react"
import {
  ChevronDown,
  ChevronUp,
  Flag,
  Pencil,
} from "lucide-react"

import type { SubjectReference } from "@/types/subjects"
import type { GuideReference, HydratedGuide } from "@/types/guides"

import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CollapsibleSection } from "@/components/CollapsibleSection"


import { extractHeadings, formatDuration } from "@/lib/guideUtils"
import { getGuideBySlug, hydrateGuide } from "@/lib/getData"

import guides from "@/data/guides.json"
import subjects from "@/data/subjects.json"

export const Route = createFileRoute("/guides/$slug")({
  component: RouteComponent,
})

function RouteComponent() {
  const { slug } = Route.useParams()

  const guide = getGuideBySlug(guides, slug);

  if (!guide) { throw notFound }

  const hydratedGuide: HydratedGuide = hydrateGuide(guide, guides, subjects);

  const headings = useMemo(() => extractHeadings(guide.content), [])

  return (
    <div className="mx-auto max-w-[1280px] h-[calc(100vh-70px)] border-x bg-background">

      <section className="grid grid-cols-[320px_1fr] border-b">
        {/* SIDEBAR */}
        <aside className="h-[calc(100vh-70px)] overflow-y-auto border-r px-6 py-6">
          {/* Prerequisites */}
          <CollapsibleSection title="Prerequisites">
            <ul className="space-y-2">
              {hydratedGuide.prerequisites.map((prereq: GuideReference) => (
                <li
                  key={prereq.slug}
                  className="text-sm text-muted-foreground hover:text-foreground cursor-pointer"
                  style={{
                    paddingLeft: 6
                  }}
                >{prereq.title}</li>
              ))}
            </ul>
          </CollapsibleSection>

          {/* TOC */}
          <CollapsibleSection title="Table of Contents">
            <ul className="space-y-2">
              {headings.map((h, idx) => (
                <li
                  key={idx}
                  className="text-sm text-muted-foreground hover:text-foreground cursor-pointer"
                  style={{
                    paddingLeft: h.level === 1 ? 6 : h.level === 2 ? 12 : h.level === 3 ? 24: 28,
                  }}
                >
                  {h.text}
                </li>
              ))}
            </ul>
          </CollapsibleSection>

          {/* Variants */}
          <CollapsibleSection title="Variants">
            <ul className="space-y-2">
            </ul>
          </CollapsibleSection>
        </aside>

        {/* MAIN */}
        <main className="h-[calc(100vh-70px)] overflow-y-auto px-10 py-8 lg:px-16">

          {/* Breadcrumbs */}
          <div className="mb-6 flex items-center justify-between">

            <ul className="flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-muted-foreground">
              {hydratedGuide.breadcrumbs.map((crumb: string, idx: number) => (
                <li key={crumb} className="flex items-center gap-2 mono-micro">
                  <span>{crumb}</span>
                  {idx < guides[0].breadcrumbs.length - 1 && <span>/</span>}
                </li>
              ))}
            </ul>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button variant="default" size="icon">
                <Pencil className="h-4 w-4" />
              </Button>

              <Button variant="outline">
                Open in Graph
              </Button>

              <Button variant="ghost" size="icon">
                <ChevronUp className="h-4 w-4" />
              </Button>

              <Button variant="ghost" size="icon">
                <ChevronDown className="h-4 w-4" />
              </Button>

              <Button variant="ghost" size="icon">
                <Flag className="h-4 w-4" />
              </Button>

              <select className="h-8 rounded-md border bg-background px-2 text-xs">
                <option>EN</option>
                <option>FR</option>
                <option>DE</option>
              </select>
            </div>
          </div>

          <Separator className="mb-8" />

          {/* Header */}
          <header className="mb-5">
            <h1 className="text-3xl font-bold tracking-[-0.04em]">
              {hydratedGuide.title}
            </h1>

            <div className="mt-3 mono-micro">
              {hydratedGuide.author} | {guides[0].created_at} | {formatDuration(guide.duration)}
            </div>

            <div className="mt-4 flex gap-2">
              {hydratedGuide.tags.map((tag: SubjectReference) => (
                <Badge
                  key={tag.slug}
                  variant="outline"
                  className="rounded-full border bg-badge text-badge-foreground mono-micro tracking-[0.08em]"
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          </header>

          <Separator className="mb-8" />

          <article className="markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {hydratedGuide.content}
            </ReactMarkdown>
          </article>
        </main>
      </section>
    </div>
  )
}