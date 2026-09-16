import { Link } from "@tanstack/react-router";
import { ArrowRight, ListChecks } from "lucide-react";
import { BaseGuideModal } from "./BaseGuideModal";
import type {
  GuideReference,
  TodoPrerequisiteReference,
} from "@bluelearn/schemas";
import { Badge } from "@/components/ui/badge";

type PrerequisitesModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prerequisites: Array<GuideReference>;
  todoPrerequisites: Array<TodoPrerequisiteReference>;
  guideTitle: string;
  slug: string;
};

export function PrerequisitesModal({
  open,
  onOpenChange,
  prerequisites,
  todoPrerequisites,
  guideTitle,
  slug,
}: PrerequisitesModalProps) {
  return (
    <BaseGuideModal
      open={open}
      onOpenChange={onOpenChange}
      title="Prerequisites"
      description="Guides worth reading before this one."
      isEmpty={prerequisites.length + todoPrerequisites.length === 0}
      emptyIcon={<ListChecks className="h-6 w-6" />}
      emptyTitle="None declared"
      emptyDescription="This guide does not list any prerequisites."
    >
      {prerequisites.map((prereq) => (
        <Link
          key={prereq.slug}
          to="/guides/$slug"
          params={{ slug: prereq.slug }}
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
          <h4 className="text-xs font-bold text-foreground">{prereq.title}</h4>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-foreground" />
        </Link>
      ))}

      {/* There's no guide to link to until the todo is resolved. */}
      {todoPrerequisites.map((todo) => (
        <div
          key={todo.id}
          className="flex w-full flex-col gap-1.5 rounded-lg border border-border bg-card p-3.5"
        >
          <div className="flex items-center justify-between gap-2">
            <h4 className="min-w-0 text-xs font-bold break-words text-foreground">
              {todo.title}
            </h4>
            <Badge
              variant="outline"
              className="border-transparent bg-brand-bright-blue/15 font-mono tracking-[0.06em] text-brand-dark-navy uppercase dark:text-brand-bright-blue"
            >
              Todo
            </Badge>
          </div>
          <p className="text-xs break-words text-muted-foreground">
            {todo.summary}
          </p>
        </div>
      ))}
    </BaseGuideModal>
  );
}
