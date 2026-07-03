import { Link } from "@tanstack/react-router"
import type { LearningPathRevision } from "@/types/paths"

import {
  Card,
  CardFooter,
  CardHeader,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

import { Route as PathRoute } from "@/routes/paths.$slug"


type PropTypes = {
  contribution: LearningPathRevision;
}

export const PathContributionCard = ({ contribution }: PropTypes) => {
  return (
    <Card className="group rounded-md bg-background shadow-none transition-colors hover:bg-muted">
      {/* Header */}
      <CardHeader className="space-y-3 border-b p-6">
        <div className="flex items-start justify-between gap-4">
          <p className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
            Path Submission
          </p>
          <Badge
            variant="outline"
            className="bg-badge text-badge-foreground border border-badge-border rounded-full mono-micro tracking-[0.08em]"
          >
            Pending Review
          </Badge>
        </div>

        <Link
          to={PathRoute.to}
          params={{ slug: contribution.path_id }}
        >
          <h3 className="line-clamp-2 text-xl font-semibold tracking-tight">
            {contribution.title}
          </h3>
        </Link>

        <p className="max-w-2xl text-sm text-muted-foreground">
          {contribution.summary}
        </p>
      </CardHeader>

      {/* Footer */}
      <CardFooter className="grid grid-cols-2 lg:grid-cols-4 p-0">
        <div className="border-r px-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            Contributor
          </p>
          <p className="mt-1 text-sm font-semibold truncate">{contribution.contributor_id}</p>
        </div>

        <div className="border-r px-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            Submitted
          </p>
          <p className="mt-1 text-sm font-semibold">{new Date(contribution.created_at).toLocaleDateString()}</p>
        </div>

        <div className="col-span-2 flex items-center justify-around px-4">
          <Button variant="outline" className="btn-sec">
            View Changes
          </Button>

          <Button className="btn-pri">
            Review
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
