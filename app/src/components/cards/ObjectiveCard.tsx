import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { RegisteredRouter, ToPathOption } from "@tanstack/react-router";

import type { HydratedObjective } from "@/types/objectives";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Footer } from "@/components/cards/Footer";

type ObjectiveProp = HydratedObjective & {
  stats?: Array<{ label: string; data: number }>;
  actionBtns?: React.ReactNode;
};

type PropTypes = {
  objective: ObjectiveProp;
  to: ToPathOption<RegisteredRouter>;
};

export const ObjectiveCard = ({ objective, to }: PropTypes) => {
  const previewLevels = objective.levels.slice(0, 3);

  return (
    <Link to={to} params={{ slug: objective.slug }}>
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

          <h3 className="line-clamp-2 text-xl font-semibold tracking-tight">
            {objective.title}
          </h3>

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
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            {previewLevels.map((level, index) => (
              <div
                key={index}
                className="flex flex-col items-center gap-2 sm:min-w-0 sm:flex-1 sm:flex-row"
              >
                <div className="flex w-40 flex-col items-center justify-center sm:w-auto sm:min-w-0">
                  <p className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-badge px-2 text-xl">
                    {level.level}
                  </p>

                  <p className="line-clamp-4 py-2 text-center text-sm">
                    {level.guide.title}
                  </p>
                </div>

                {(index < previewLevels.length - 1 ||
                  objective.levels.length >= 3) && (
                  <ArrowRight className="h-5 w-5 shrink-0 rotate-90 sm:rotate-0" />
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
          <Footer
            data={{ stats: objective.stats, actionBtns: objective.actionBtns }}
          />
        )}
      </Card>
    </Link>
  );
};
