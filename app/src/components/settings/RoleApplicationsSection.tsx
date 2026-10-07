import { useState } from "react";
import { toast } from "sonner";
import { applicableRoleSchema } from "@bluelearn/schemas";

import type { ApplicableRole, RoleApplication } from "@/lib/api/identity";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/guideUtils";

// Matches role_applications_statement_length in the database.
export const STATEMENT_MAX_LENGTH = 2000;

// What each role takes on, in the words of docs/overall-system.md, so a member
// knows what they are asking for.
const ROLE_DUTIES: Record<ApplicableRole, string> = {
  verifier:
    "Sits on the pre-publish review panels that check a submission's structure, scope and duplication before it goes live. Careful reading, not subject expertise.",
  moderator:
    "Sits on the post-publish panels: re-reviews flagged guides and hears disputes and appeals.",
};

export type RoleStanding =
  | { kind: "held" }
  | { kind: "pending"; since: string }
  | { kind: "rejected"; on: string }
  | { kind: "open" };

// Where a member stands with one role: holding it, waiting on an admin, turned
// down (and free to apply again), or never having applied. The newest
// application speaks for the role.
export function roleStanding(
  role: ApplicableRole,
  roles: ReadonlyArray<string>,
  applications: ReadonlyArray<RoleApplication>
): RoleStanding {
  if (roles.includes(role)) return { kind: "held" };

  const latest = applications
    .filter((application) => application.role === role)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .at(0);

  if (latest?.status === "pending") {
    return { kind: "pending", since: latest.created_at };
  }
  if (latest?.status === "rejected") {
    return { kind: "rejected", on: latest.decided_at ?? latest.created_at };
  }
  return { kind: "open" };
}

type RoleApplicationsSectionProps = {
  roles: ReadonlyArray<string>;
  applications: ReadonlyArray<RoleApplication>;
  onApply: (role: ApplicableRole, statement: string | null) => Promise<void>;
};

const BADGE_CLASS =
  "mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground";

export function RoleApplicationsSection({
  roles,
  applications,
  onApply,
}: RoleApplicationsSectionProps) {
  // The role stays set while the dialog closes so its text does not blank out
  // mid-animation.
  const [role, setRole] = useState<ApplicableRole>("verifier");
  const [open, setOpen] = useState(false);
  const [statement, setStatement] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const startApplication = (next: ApplicableRole) => {
    setRole(next);
    setStatement("");
    setOpen(true);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await onApply(role, statement.trim() || null);
      toast.success(`Applied to become a ${role}. An admin will review it.`);
      setOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not send the application."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="font-mono text-[12px] tracking-[0.08em] text-muted-foreground uppercase">
        Roles
      </h2>

      <div className="border-t border-border">
        <p className="py-3 text-xs text-muted-foreground">
          Every member is a learner. Verifiers and moderators are volunteers an
          admin approves: apply below, and the role appears here once it is
          granted.
        </p>

        <ul className="divide-y divide-border">
          {applicableRoleSchema.options.map((candidate) => {
            const standing = roleStanding(candidate, roles, applications);

            return (
              <li
                key={candidate}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs tracking-[0.08em] uppercase">
                      {candidate}
                    </span>
                    {standing.kind === "held" && (
                      <Badge variant="outline" className={BADGE_CLASS}>
                        Held
                      </Badge>
                    )}
                    {standing.kind === "pending" && (
                      <Badge variant="outline" className={BADGE_CLASS}>
                        Pending
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {ROLE_DUTIES[candidate]}
                  </p>
                  {standing.kind === "pending" && (
                    <p className="text-xs text-muted-foreground">
                      Applied {formatDate(new Date(standing.since))}. An admin
                      will review it.
                    </p>
                  )}
                  {standing.kind === "rejected" && (
                    <p className="text-xs text-muted-foreground">
                      Not approved on {formatDate(new Date(standing.on))}. You
                      can apply again.
                    </p>
                  )}
                </div>

                {(standing.kind === "open" || standing.kind === "rejected") && (
                  <Button
                    variant="outline"
                    size="lg"
                    className="btn-sec shrink-0"
                    onClick={() => startApplication(candidate)}
                  >
                    {standing.kind === "rejected" ? "Apply again" : "Apply"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && submitting) return;
          setOpen(next);
        }}
      >
        <DialogContent className="gap-0 p-0 sm:max-w-md">
          <DialogHeader className="gap-2 p-5 pb-0">
            <DialogTitle className="editorial-heading text-lg">
              Apply to become a {role}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {ROLE_DUTIES[role]} An admin reviews every application.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 p-5">
            <FieldLabel
              htmlFor="role-statement"
              className="mono-micro text-muted-foreground"
            >
              Statement{" "}
              <span className="text-foreground normal-case">(optional)</span>
            </FieldLabel>
            <Textarea
              id="role-statement"
              rows={5}
              maxLength={STATEMENT_MAX_LENGTH}
              placeholder="Why you, why now: what you have reviewed, written or moderated before."
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
            />
            <p className="text-right text-xs text-muted-foreground">
              {statement.length}/{STATEMENT_MAX_LENGTH}
            </p>
          </div>

          <DialogFooter className="p-5 pt-0">
            <DialogClose asChild>
              <Button
                variant="outline"
                size="lg"
                className="btn-sec"
                disabled={submitting}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="default"
              size="lg"
              className="btn-pri"
              disabled={submitting}
              onClick={submit}
            >
              {submitting ? "Sending..." : "Send application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
