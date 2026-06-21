import { Link } from "@tanstack/react-router"
import type { Subject } from "@/types/subjects"

import {
  Card,
  CardFooter,
  CardHeader,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

import { Route as SubjectRoute } from "@/routes/subjects.$slug"


type PropTypes = {
  subject: Subject;
}

export const SubjectCard = ({ subject }: PropTypes) => {
  return (
    <Card className="group rounded-md bg-background shadow-none transition-colors hover:bg-muted">
      {/* Header */}
      <CardHeader className="space-y-3 border-b p-6">
        <p className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
          Subject
        </p>

        <Link
          to={SubjectRoute.to}
          params={{ slug: subject.slug }}
        >
          <h3 className="line-clamp-2 text-xl font-semibold tracking-tight">
            {subject.name}
          </h3>
        </Link>

        <p className="max-w-2xl text-sm text-muted-foreground">
          {subject.summary}
        </p>
      </CardHeader>

      {/* Footer */}
      <CardFooter className="grid grid-cols-2 lg:grid-cols-4 p-0">
        <div className="border-r px-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            Paths
          </p>
          <p className="mt-1 text-lg font-semibold">{subject.paths_total}</p>
        </div>

        <div className="border-r px-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            Guides
          </p>
          <p className="mt-1 text-lg font-semibold">{subject.guides_total}</p>
        </div>

        <div className="col-span-2 flex items-center justify-around px-4">
          <Button variant="outline">
            View Graph
          </Button>

          <Button variant="default">
            Start Learning
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}