import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/guideUtils";
import { cn } from "@/lib/utils";

export type PanelDecision = {
  id: string;
  decision: string;
  notes: string | null;
  reasons: Array<string>;
  created_at: string;
  member_username: string | null;
};

const REASON_LABELS: Record<string, string> = {
  hierarchy_issue: "Hierarchy Issues",
  factual_error: "Factual Error",
  duplicate_content: "Duplicate Content",
  scope_violation: "Scope Violation",
  clarity_issue: "Clarity Issues",
  missing_required_information: "Missing Required Information",
};

export const DecisionList = ({
  decisions,
}: {
  decisions: Array<PanelDecision>;
}) => {
  if (decisions.length === 0)
    return <p className="text-xs text-muted-foreground">No votes cast.</p>;

  return (
    <ul className="space-y-3">
      {decisions.map((d) => {
        const rejected = d.decision !== "approved";

        return (
          <li key={d.id} className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  "font-mono text-[11px] font-bold tracking-[0.08em] uppercase",
                  rejected
                    ? "text-red-600 dark:text-red-400"
                    : "text-green-700 dark:text-green-400"
                )}
              >
                {rejected ? "Changes requested" : "Approved"}
              </span>
              <span className="mono-micro text-muted-foreground">
                {formatDate(new Date(d.created_at))}
              </span>
            </div>

            {d.member_username && (
              <p className="text-xs text-muted-foreground">
                @{d.member_username}
              </p>
            )}

            {d.reasons.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {d.reasons.map((r) => (
                  <Badge
                    key={r}
                    variant="outline"
                    className="border-transparent bg-muted-foreground/8 font-mono tracking-[0.06em] text-muted-foreground uppercase"
                  >
                    {REASON_LABELS[r] ?? r}
                  </Badge>
                ))}
              </div>
            )}

            {d.notes && (
              <p className="text-xs whitespace-pre-wrap">{d.notes}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
};
