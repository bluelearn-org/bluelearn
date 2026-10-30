import { Link } from "@tanstack/react-router";
import { ArrowRight, ListChecks } from "lucide-react";
import { BaseGuideModal } from "./BaseGuideModal";
import type { GuideReference } from "@bluelearn/schemas";

type FollowUpsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  followUps: Array<GuideReference>;
  guideTitle: string;
  slug: string;
};

export function FollowUpsModal({
  open,
  onOpenChange,
  followUps,
  guideTitle,
  slug,
}: FollowUpsModalProps) {
  return (
    <BaseGuideModal
      open={open}
      onOpenChange={onOpenChange}
      title="Follow-Ups"
      description="Guides worth reading after this one."
      isEmpty={followUps.length === 0}
      emptyIcon={<ListChecks className="h-6 w-6" />}
      emptyTitle="None declared"
      emptyDescription="This guide does not list any follow-ups."
    >
      {followUps.map((followUp) => (
        <Link
          key={followUp.slug}
          to="/guides/$slug"
          params={{ slug: followUp.slug }}
          state={{
            breadcrumbOrigin: {
              type: "guide",
              title: guideTitle,
              path: `/guides/${slug}`,
            },
          }}
          onClick={() => onOpenChange(false)}
          className="group flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-card p-3.5 transition-colors hover:bg-muted"
        >
          <h4 className="text-xs font-bold text-foreground">
            {followUp.title}
          </h4>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-foreground" />
        </Link>
      ))}
    </BaseGuideModal>
  );
}
