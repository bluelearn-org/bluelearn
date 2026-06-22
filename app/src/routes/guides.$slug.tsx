import { createFileRoute } from "@tanstack/react-router"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useMemo } from "react"
import {
  Bookmark,
  ExternalLink,
  Flag,
  MessageSquare,
} from "lucide-react"

import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import guides from "@/data/guides.json"
import { extractHeadings } from "@/lib/guideUtils"
import { CollapsibleSection } from "@/components/CollapsibleSection"

export const Route = createFileRoute("/guides/$slug")({
  component: RouteComponent,
})

function RouteComponent() {
  const headings = useMemo(() => extractHeadings(guides[0].content), [])

  return (
    <div className="mx-auto max-w-[1280px] h-[calc(100vh-70px)] border-x bg-background">

      <section className="grid grid-cols-[320px_1fr] border-b">

        {/* SIDEBAR */}
        <aside className="h-[calc(100vh-70px)] overflow-y-auto border-r px-6 py-6">

          {/* Cards */}
          <div className="mb-6 grid grid-cols-2 gap-3 text-center">

            <div className="rounded-md border p-3 place-content-center">
              <p className="data-label">
                Read time
              </p>
              <p className="mt-1 data-value">10 min</p>
            </div>

            <div className="rounded-md border p-3 place-content-center">
              <p className="data-label">
                Level
              </p>
              <p className="mt-1 data-value">3</p>

              <Button
                variant="link"
                className="mt-1 h-auto p-0 text-xs text-brand-blue"
              >
                View Graph <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Prerequisites */}
          <CollapsibleSection title="Prerequisites">
            <ul className="list-disc pl-4">
              {guides[0].prerequisites.map((item: string) => (
                <li key={item}>{item}</li>
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
                    paddingLeft: h.level === 2 ? 0 : h.level === 3 ? 12 : 24,
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
              {guides[0].breadcrumbs.map((crumb: string, idx: number) => (
                <li key={crumb} className="flex items-center gap-2 mono-micro">
                  <span>{crumb}</span>
                  {idx < guides[0].breadcrumbs.length - 1 && <span>/</span>}
                </li>
              ))}
            </ul>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon">
                <MessageSquare className="h-4 w-4" />
              </Button>

              <Button variant="ghost" size="icon">
                <Bookmark className="h-4 w-4" />
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
          <header className="mb-10">
            <h1 className="text-3xl font-bold tracking-[-0.04em]">
              {guides[0].title}
            </h1>

            <div className="mt-3 mono-micro">
              {guides[0].author} • {guides[0].created_at}
            </div>

            <div className="mt-4 flex gap-2">
              {guides[0].tags.map((tag: string) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="rounded-full border bg-badge text-badge-foreground mono-micro tracking-[0.08em]"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </header>

          <article className="markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {guides[0].content}
            </ReactMarkdown>
          </article>
        </main>
      </section>
    </div>
  )
}