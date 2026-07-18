import { Link } from "@tanstack/react-router";
import type { RegisteredRouter, ToPathOption } from "@tanstack/react-router";

import type { BreadcrumbOrigin } from "@/lib/breadcrumbs";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Footer } from "@/components/cards/Footer";

// Only the fields the card renders. Callers pass a superset (a full static
// Guide, or an API list item mapped to these keys).
type GuideProp = {
  slug: string;
  title: string;
  author?: string | null;
  summary?: string | null;
  created_at?: string;
  status?: string;
  tags?: Array<string | { slug: string; name: string }>;
  stats?: Array<{ label: string; data: string | number }>;
  actionBtns?: React.ReactNode;
};

type PropTypes = {
  guide: GuideProp;
  origin?: BreadcrumbOrigin;
  to: ToPathOption<RegisteredRouter>;
};

export const GuideCard = ({ guide, origin, to }: PropTypes) => {
  return (
    <Link
      to={to}
      params={{ slug: guide.slug }}
      state={{ breadcrumbOrigin: origin }}
    >
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

          <h3 className="line-clamp-2 text-xl font-semibold tracking-tight">
            {guide.title}
          </h3>

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
            {(guide.tags ?? []).map((tag) => {
              const slug = typeof tag === "string" ? tag : tag.slug;
              const name = typeof tag === "string" ? tag : tag.name;
              return (
                <Badge
                  key={slug}
                  variant="outline"
                  className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
                >
                  {name}
                </Badge>
              );
            })}
          </div>
        </CardContent>

        {/* Footer */}
        {(guide.stats || guide.actionBtns) && (
          <Footer data={{ stats: guide.stats, actionBtns: guide.actionBtns }} />
        )}
      </Card>
    </Link>
  );
};
