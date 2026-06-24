import { Link } from "@tanstack/react-router"

import type { Guide } from "@/types/guides"

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import { Route as GuideRoute } from "@/routes/guides.$slug"
import { formatDuration } from "@/lib/guideUtils"


type PropTypes = {
  guide: Guide;
  level?: number;
}

export const GuideCard = ({ guide, level }: PropTypes) => {
  return (
    <Card className="group rounded-md bg-background shadow-none transition-colors hover:bg-muted">
      {/* Header */}
      <CardHeader className="relative p-4">
        <div className="absolute right-6 top-6">
          <Badge
            variant="outline"
            className="bg-badge text-badge-foreground border border-badge-border rounded-full mono-micro tracking-[0.08em]"
          >
            Not Started
          </Badge>
        </div>

        <p className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
          Guide
        </p>

        <Link
          to={GuideRoute.to}
          params={{ slug: guide.slug }}
        >
          <h3 className="line-clamp-2 text-xl font-semibold tracking-tight">
            {guide.title}
          </h3>
        </Link>

        <div className="flex items-center justify-between text-sm">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">@{guide.author} | {guide.created_at}</p>
        </div>
      </CardHeader>

      {/* Metadata */}
      <CardContent className="border-t p-4">
        {/* Summary */}
        <p className="max-w-2xl text-sm text-muted-foreground">
          {guide.summary}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap pyt-4 gap-2">
          {guide.tags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="bg-badge text-badge-foreground border border-badge-border rounded-full mono-micro tracking-[0.08em]"
            >
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>

      {/* Footer */}
      <CardFooter className="grid grid-cols-4 border-t p-0">
        {level && <div className="border-r px-4">
          <p className="font-mono uppercase tracking-[0.08em] text-muted-foreground">
            Level
          </p>
          <p className="mt-1 text-lg font-semibold">{level}</p>
        </div>}

        <div className="border-r px-4">
          <p className="font-mono uppercase tracking-[0.08em] text-muted-foreground">
            Duration
          </p>
          <p className="mt-1 text-lg font-semibold">{formatDuration(guide.duration)}</p>
        </div>

        <div className="col-span-2 flex justify-around items-center px-4">
          <Button variant="outline" className="btn-sec">
            Open in Graph
          </Button>

          <Button className="btn-pri">
            Start Reading
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}