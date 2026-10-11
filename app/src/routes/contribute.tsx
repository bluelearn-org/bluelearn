import { createFileRoute, useNavigate } from "@tanstack/react-router";

import type { ContributionType } from "@/types/contributions";
import ContributionFlow from "@/components/contribute/ContributionFlow";
import { requireSession } from "@/lib/auth";
import { useAuth, useSuspensionStatus } from "@/lib/authContext";
import { RejectionFeedback } from "@/components/review/RejectionFeedback";
import { ErrorFallback } from "@/components/ErrorFallback";
import { AccountStatusNotice } from "@/components/AccountStatusNotice";
import { buildPageMeta } from "@/lib/seo";

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

// True when the URL itself asks for guide or variant authoring: a picked type,
// a todo seed, or a resumed guide/variant draft.
// Objective drafts always ride with kind=objective (ActivityTable, ReviewSidebar),
// so a bare draft id is a guide or variant.
// Objective work and the blank type picker pass through.
export function requestsGuideAuthoring(search: ContributeSearch) {
  if (
    search.contributionType === "guide" ||
    search.contributionType === "variant"
  ) {
    return true;
  }

  if (search.todoTitle || search.todos) return true;

  return !!search.draft && search.kind !== "objective";
}

export const Route = createFileRoute("/contribute")({
  head: () => ({
    // The form is client-only and can redirect to login before it loads.
    meta: import.meta.env.SSR
      ? []
      : buildPageMeta(
          "Contribute",
          "Share what you know on Bluelearn. Write a guide, offer a different explanation, or create a learning objective."
        ),
  }),
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
  const search = Route.useSearch();
  const { roles } = useAuth();
  const status = useSuspensionStatus();

  if (status === "pending") return null;
  if (status === "unavailable") {
    return <AccountStatusNotice status="unavailable" />;
  }

  if (status === "suspended") {
    const isCurator = roles.includes("curator");
    const refused = !isCurator || requestsGuideAuthoring(search);

    if (refused) {
      return <AccountStatusNotice status="suspended" />;
    }
  }

  return <ContributePage />;
}

function ContributePage() {
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
