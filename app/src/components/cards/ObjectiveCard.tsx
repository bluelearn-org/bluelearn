import { Fragment } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { RegisteredRouter, ToPathOption } from "@tanstack/react-router";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Footer } from "@/components/cards/Footer";

type PathStep = { position: number; slug: string | null; title: string | null };

// Only the fields the card renders. Callers pass a superset (a full static
// HydratedObjective, or an API list item mapped to these keys). The graph reads
// featuredPath when present and otherwise falls back to the legacy levels shape
// that routes still on static data supply.
type ObjectiveProp = {
  slug: string;
  title: string | null;
  summary?: string | null;
  curator?: string | null;
  created_at?: string;
  status?: string;
  featuredPath?: Array<PathStep>;
  levels?: Array<{ level: number; guide: { title: string } }>;
  stats?: Array<{ label: string; data: string | number }>;
  actionBtns?: React.ReactNode;
};

type PropTypes = {
  objective: ObjectiveProp;
  to: ToPathOption<RegisteredRouter>;
};

const graphRow =
  "flex flex-col items-center justify-center gap-3 sm:flex-row sm:items-start sm:gap-2";
const graphCell =
  "flex w-full flex-col items-center gap-2 text-center sm:w-24 md:w-28";
const nodeBadge =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-badge text-base font-medium";
const collapseMarker =
  "flex h-8 shrink-0 items-center justify-center text-base font-medium";
const stepTitle = "line-clamp-3 text-sm leading-snug text-muted-foreground";
const arrow =
  "mt-1.5 h-4 w-4 shrink-0 rotate-90 text-muted-foreground sm:rotate-0";

// The featured target plus the guides leading up to it. Only the last three
// steps are drawn; the rest collapse into a leading "N guides" marker.
function FeaturedPathGraph({ path }: { path: Array<PathStep> }) {
  const shown = path.slice(-3);
  const hidden = path.length - shown.length;

  return (
    <CardContent className="border-t p-4">
      <div className={graphRow}>
        {hidden > 0 && (
          <>
            <div className={graphCell}>
              <span className={collapseMarker}>{hidden}</span>
              <span className={stepTitle}>more guides</span>
            </div>
            <ArrowRight className={arrow} />
          </>
        )}
        {shown.map((step, index) => (
          <Fragment key={step.position}>
            <div className={graphCell}>
              <span className={nodeBadge}>{step.position}</span>
              <span className={stepTitle}>{step.title}</span>
            </div>
            {index < shown.length - 1 && <ArrowRight className={arrow} />}
          </Fragment>
        ))}
      </div>
    </CardContent>
  );
}

// Legacy graph for routes still feeding static level data.
function LevelsGraph({
  levels,
}: {
  levels: Array<{ level: number; guide: { title: string } }>;
}) {
  const previewLevels = levels.slice(0, 3);
  const remaining = levels.length - previewLevels.length;

  return (
    <CardContent className="border-t p-4">
      <div className={graphRow}>
        {previewLevels.map((level, index) => (
          <Fragment key={index}>
            <div className={graphCell}>
              <span className={nodeBadge}>{level.level}</span>
              <span className={stepTitle}>{level.guide.title}</span>
            </div>
            {(index < previewLevels.length - 1 || remaining > 0) && (
              <ArrowRight className={arrow} />
            )}
          </Fragment>
        ))}
        {remaining > 0 && (
          <div className={graphCell}>
            <span className={collapseMarker}>{remaining}</span>
            <span className={stepTitle}>more levels</span>
          </div>
        )}
      </div>
    </CardContent>
  );
}

export const ObjectiveCard = ({ objective, to }: PropTypes) => {
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
        {objective.featuredPath !== undefined
          ? objective.featuredPath.length > 0 && (
              <FeaturedPathGraph path={objective.featuredPath} />
            )
          : objective.levels && <LevelsGraph levels={objective.levels} />}

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
