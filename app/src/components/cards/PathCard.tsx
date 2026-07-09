import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import type { HydratedPath } from "@/types/paths";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Route as LearningPathRoute } from "@/routes/paths.$slug";
import { formatDuration } from "@/lib/guideUtils";

type PropTypes = {
  path: HydratedPath;
};

export const PathCard = ({ path }: PropTypes) => {
  const previewLevels = path.levels.slice(0, 3);

  return (
    <Card className="group flex flex-col justify-between rounded-md bg-background shadow-none transition-colors hover:bg-muted">
      {/* Header */}
      <CardHeader className="relative p-4">
        <div className="absolute top-6 right-6">
          <Badge
            variant="outline"
            className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
          >
            Not Started
          </Badge>
        </div>

        <p className="mb-3 font-mono text-xs tracking-wide text-muted-foreground uppercase">
          Path
        </p>

        <Link to={LearningPathRoute.to} params={{ slug: path.slug }}>
          <h3 className="line-clamp-2 text-xl font-semibold tracking-tight">
            {path.title}
          </h3>
        </Link>

        <p className="max-w-2xl text-sm text-muted-foreground">
          {path.summary}
        </p>

        <div className="flex items-center justify-between text-sm">
          <p className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
            @{path.curator} | {path.created_at}
          </p>
        </div>
      </CardHeader>

      {/* Graph Preview */}
      <CardContent className="space-y-2 border-t p-4">
        <div className="flex items-center justify-between gap-4">
          {previewLevels.map((level, index) => (
            <div
              key={level.guide.slug}
              className="flex min-w-0 flex-1 items-center gap-2"
            >
              <div className="flex flex-col items-center justify-center">
                <p className="flex h-8 w-8 items-center justify-center rounded-full bg-badge px-2 text-xl">
                  {level.level}
                </p>

                <p className="line-clamp-4 py-2 text-center text-sm">
                  {level.guide.title}
                </p>
              </div>

              {(index < previewLevels.length - 1 ||
                path.levels.length >= 3) && (
                <ArrowRight className="h-5 w-5 shrink-0" />
              )}
              {index >= previewLevels.length - 1 && (
                <div className="text-center">
                  <p>{path.levels.length - 3}</p>

                  <p className="text-xs text-muted-foreground">more levels</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>

      {/* Footer */}
      <CardFooter className="grid grid-cols-4 border-t p-0">
        <div className="border-r px-4">
          <p className="font-mono tracking-[0.08em] text-muted-foreground uppercase">
            Duration
          </p>

          <p className="mt-1 text-lg font-semibold">
            {formatDuration(path.duration)}
          </p>
        </div>

        <div className="border-r px-4">
          <p className="font-mono tracking-[0.08em] text-muted-foreground uppercase">
            Levels
          </p>

          <p className="mt-1 text-lg font-semibold">{path.levels.length}</p>
        </div>

        <div className="col-span-2 flex items-center justify-around px-4">
          <Button variant="outline" className="btn-sec">
            Open in Graph
          </Button>

          <Button className="btn-pri">Start Reading</Button>
        </div>
      </CardFooter>
    </Card>
  );
};
