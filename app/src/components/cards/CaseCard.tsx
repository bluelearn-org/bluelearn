import { Link } from "@tanstack/react-router";
import type { RegisteredRouter, ToPathOption } from "@tanstack/react-router";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Only the fields the card renders. Callers pass a superset (a full static
// Guide, or an API list item mapped to these keys).
type CaseProp = {
  id: string;
  case_type: string;
  status: string;
  title: string | null;
  created_at: string;
};

type PropTypes = {
  reviewCase: CaseProp;
  to: ToPathOption<RegisteredRouter>;
};

export const CaseCard = ({ reviewCase, to }: PropTypes) => {
  return (
    <Link to={to} params={{ caseId: reviewCase.id }}>
      <Card className="group rounded-md bg-background shadow-none transition-colors hover:bg-muted">
        {/* Header */}
        <CardHeader className="relative p-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
              Review Case
            </p>
            {reviewCase.status && (
              <Badge
                variant="outline"
                className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
              >
                {reviewCase.status}
              </Badge>
            )}
          </div>

          <h3 className="line-clamp-2 text-xl font-semibold tracking-tight">
            {reviewCase.id}
          </h3>

          <div className="flex items-center justify-between text-sm">
            <p className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
              @{reviewCase.status} | {reviewCase.created_at}
            </p>
          </div>
        </CardHeader>

        {/* Metadata */}
        <CardContent className="border-t p-4">
          {/* Status */}
          <p className="max-w-2xl text-sm text-muted-foreground">
            {reviewCase.status}
          </p>
          {/* Title */}
          <p className="max-w-2xl text-sm text-muted-foreground">
            {reviewCase.title ?? "Case has no title."}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
};
