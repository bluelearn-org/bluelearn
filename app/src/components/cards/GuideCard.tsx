import { Link } from "@tanstack/react-router";

import type { Guide } from "@/types/guides";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FooterStats } from "@/components/cards/FooterStats";

import { Route as GuideRoute } from "@/routes/guides.$slug";

type GuideProp = Guide & {
  stats?: Array<{ label: string; data: number }>;
  actionBtns?: React.ReactNode;
};

type PropTypes = {
  guide: GuideProp;
};

export const GuideCard = ({ guide }: PropTypes) => {
  return (
    <Card className="group rounded-md bg-background shadow-none transition-colors hover:bg-muted">
      {/* Header */}
      <CardHeader className="relative p-4">
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
            Guide
          </p>
          {guide.status && (
            <Badge
              variant="outline"
              className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
            >
              {guide.status}
            </Badge>
          )}
        </div>

        <Link to={GuideRoute.to} params={{ slug: guide.slug }}>
          <h3 className="line-clamp-2 text-xl font-semibold tracking-tight">
            {guide.title}
          </h3>
        </Link>

        <div className="flex items-center justify-between text-sm">
          <p className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
            @{guide.author} | {guide.created_at}
          </p>
        </div>
      </CardHeader>

      {/* Metadata */}
      <CardContent className="border-t p-4">
        {/* Summary */}
        <p className="max-w-2xl text-sm text-muted-foreground">
          {guide.summary}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 pt-4">
          {guide.tags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
            >
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>

      {/* Footer */}
      {(guide.stats || guide.actionBtns) && (
        <CardFooter className="grid grid-cols-2 border-t p-0 lg:grid-cols-4">
          {guide.stats?.map((g: { label: string; data: number }) => {
            return <FooterStats label={g.label} data={g.data} />;
          })}

          {guide.actionBtns}
        </CardFooter>
      )}
    </Card>
  );
};
