import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import type { HydratedObjective } from "@/types/objectives";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FooterStats } from "@/components/cards/FooterStats";

import { Route as LearningObjectiveRoute } from "@/routes/objectives.$slug";

type ObjectiveProp = HydratedObjective & {
  stats?: Array<{ label: string; data: number }>;
  actionBtns?: React.ReactNode;
};

type PropTypes = {
  objective: ObjectiveProp;
};

export const ObjectiveCard = ({ objective }: PropTypes) => {
  const previewLevels = objective.levels.slice(0, 3);

  return (
    <Card className="group flex flex-col justify-between rounded-md bg-background shadow-none transition-colors hover:bg-muted">
      {/* Header */}
      <CardHeader className="relative p-4">
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
            Objective
          </p>
          {objective.status && (
            <Badge
              variant="outline"
              className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
            >
              {objective.status}
            </Badge>
          )}
        </div>

        <Link to={LearningObjectiveRoute.to} params={{ slug: objective.slug }}>
          <h3 className="line-clamp-2 text-xl font-semibold tracking-tight">
            {objective.title}
          </h3>
        </Link>

        <p className="max-w-2xl text-sm text-muted-foreground">
          {objective.summary}
        </p>

        <div className="flex items-center justify-between text-sm">
          <p className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
            @{objective.curator} | {objective.created_at}
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
                objective.levels.length >= 3) && (
                <ArrowRight className="h-5 w-5 shrink-0" />
              )}
              {index >= previewLevels.length - 1 && (
                <div className="text-center">
                  <p>{objective.levels.length - 3}</p>

                  <p className="text-xs text-muted-foreground">more levels</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>

      {/* Footer */}
      {(objective.stats || objective.actionBtns) && (
        <CardFooter className="grid grid-cols-2 border-t p-0 lg:grid-cols-4">
          {objective.stats?.map((g: { label: string; data: number }) => {
            return <FooterStats label={g.label} data={g.data} />;
          })}

          {objective.actionBtns}
        </CardFooter>
      )}
    </Card>
  );
};
