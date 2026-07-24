import { Link } from "@tanstack/react-router";
import type { RegisteredRouter, ToPathOption } from "@tanstack/react-router";

import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Footer } from "@/components/cards/Footer";

type SubjectProp = {
  slug: string;
  name: string;
  summary?: string | null;
  status?: string;
  stats?: Array<{ label: string; data: number }>;
  actionBtns?: React.ReactNode;
};

type PropTypes = {
  subject: SubjectProp;
  to: ToPathOption<RegisteredRouter>;
};

export const SubjectCard = ({ subject, to }: PropTypes) => {
  return (
    <Link to={to} params={{ slug: subject.slug }}>
      <Card className="group h-full rounded-md bg-background shadow-none transition-colors hover:bg-muted">
        {/* Header */}
        <CardHeader className="p-6">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
              Subject
            </p>
            {subject.status && (
              <Badge
                variant="default"
                className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
              >
                {subject.status}
              </Badge>
            )}
          </div>

          <h3 className="line-clamp-2 text-xl font-semibold tracking-tight">
            {subject.name}
          </h3>

          <p className="max-w-2xl text-sm text-muted-foreground">
            {subject.summary}
          </p>
        </CardHeader>

        {/* Footer */}
        {(subject.stats || subject.actionBtns) && (
          <Footer
            data={{ stats: subject.stats, actionBtns: subject.actionBtns }}
          />
        )}
      </Card>
    </Link>
  );
};
