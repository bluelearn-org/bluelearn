import { createFileRoute, useNavigate } from "@tanstack/react-router";

import type { ContributionType } from "@/types/contributions";
import ContributionFlow from "@/components/contribute/ContributionFlow";
import { requireSession } from "@/lib/auth";
import { RejectionFeedback } from "@/components/review/RejectionFeedback";
import { ErrorFallback } from "@/components/ErrorFallback";

export type ContributeSearch = {
  draft?: string;
  kind?: "guide" | "objective";
  contributionType?: ContributionType;
  step?: string;
  source?: string;
  edit?: string;
  todoTitle?: string;
  todoSummary?: string;
  todos?: string;
};

export const Route = createFileRoute("/contribute")({
  ssr: false,
  beforeLoad: requireSession,
  validateSearch: (search: Record<string, unknown>): ContributeSearch => {
    const draft = typeof search.draft === "string" ? search.draft : undefined;
    const kind =
      search.kind === "objective" || search.kind === "guide"
        ? search.kind
        : undefined;
    const contributionType =
      search.contributionType === "guide" ||
      search.contributionType === "variant" ||
      search.contributionType === "objective"
        ? search.contributionType
        : undefined;
    const step = typeof search.step === "string" ? search.step : undefined;
    const source =
      typeof search.source === "string" ? search.source : undefined;
    const edit = typeof search.edit === "string" ? search.edit : undefined;
    const todoTitle =
      typeof search.todoTitle === "string" ? search.todoTitle : undefined;
    const todoSummary =
      typeof search.todoSummary === "string" ? search.todoSummary : undefined;
    const todos = typeof search.todos === "string" ? search.todos : undefined;

    return {
      draft,
      kind,
      contributionType,
      step,
      source,
      edit,
      todoTitle,
      todoSummary,
      todos,
    };
  },
  errorComponent: ErrorFallback,
  component: RouteComponent,
});

function RouteComponent() {
  const {
    draft,
    kind,
    contributionType,
    step,
    source,
    edit,
    todoTitle,
    todoSummary,
    todos,
  } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const type =
    contributionType ?? (edit || kind === "objective" ? "objective" : null);

  const handleTypeChange = (newType: ContributionType) => {
    navigate({
      search: (prev) => ({
        ...prev,
        contributionType: newType,
        // Set the initial step for the selected contribution type
        step:
          newType === "guide"
            ? "guide-details"
            : newType === "variant"
              ? "variant-details"
              : "objective-details",
      }),
      replace: true,
    });
  };

  const handleStepChange = (newStep: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        step: newStep === "type" ? undefined : newStep,
        contributionType:
          newStep === "type" ? undefined : prev.contributionType,
        draft: newStep === "type" ? undefined : prev.draft,
        kind: newStep === "type" ? undefined : prev.kind,
        source: newStep === "type" ? undefined : prev.source,
        edit: newStep === "type" ? undefined : prev.edit,
      }),
      replace: true,
    });
  };

  const handlePublished = () => {
    navigate({ search: {}, replace: true });
  };

  // resumed drafts so the todo already carries claims in the database
  // params only apply to a fresh start
  const todoIds = draft || !todos ? [] : todos.split(",");

  return (
    <div className="mx-auto flex min-h-[max(calc(100vh-65px),750px)] w-full max-w-[1280px] flex-col bg-background">
      <section className="relative flex min-h-0 flex-1 gap-8 border-b px-4 pt-8">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ContributionFlow
            type={type}
            setType={handleTypeChange}
            step={step}
            onStepChange={handleStepChange}
            onPublished={handlePublished}
            draftId={draft}
            draftKind={kind}
            sourceRevisionId={source}
            editSlug={edit}
            todoTitle={draft ? undefined : todoTitle}
            todoSummary={draft ? undefined : todoSummary}
            todoIds={todoIds}
          />
        </div>
        {draft && <RejectionFeedback draftId={draft} />}
      </section>
    </div>
  );
}
