import type { ReactNode } from "react";

import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type CardShellProps = {
  type: string;
  status?: string;
  headerChildren: ReactNode;
  contentChildren?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export const CardShell = ({
  type,
  status,
  headerChildren,
  contentChildren,
  footer,
  className,
}: CardShellProps) => {
  return (
    <Card
      className={[
        "group rounded-md bg-background shadow-none transition-colors hover:bg-muted",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <CardHeader className="relative p-4">
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
            {type}
          </p>

          {status && (
            <Badge
              variant="outline"
              className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
            >
              {status}
            </Badge>
          )}
        </div>

        {headerChildren}
      </CardHeader>

      {contentChildren}

      {footer && (
        <CardFooter className="grid grid-cols-2 border-t p-0 lg:grid-cols-4">
          {footer}
        </CardFooter>
      )}
    </Card>
  );
};
