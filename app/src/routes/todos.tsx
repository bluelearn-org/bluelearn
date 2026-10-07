import { useMemo } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";

import type { TodoFilters } from "@/lib/todoFilters";
import { Separator } from "@/components/ui/separator";
import { TodoCard } from "@/components/cards/TodoCard";
import { Pagination } from "@/components/Pagination";
import { TodoFilterMenu } from "@/components/TodoFilterMenu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

import { listTodos } from "@/lib/api/todos";
import { groupTodosByTitle } from "@/lib/groupTodos";
import {
  filterTodos,
  objectiveFilterItems,
  subjectFilterItems,
} from "@/lib/todoFilters";
import { usePagination } from "@/lib/usePagination";
import { buildPageMeta } from "@/lib/seo";

const PAGE_SIZE = 10;

type TodosSearch = TodoFilters & { page?: number };

function pageParam(value: unknown) {
  const page = Number(value);
  return Number.isInteger(page) && page > 1 ? page : undefined;
}

export const Route = createFileRoute("/todos")({
  head: () => ({
    meta: buildPageMeta(
      "Guides Waiting to Be Written",
      "Explore requested guides on Bluelearn and help fill gaps in the community's learning resources."
    ),
  }),
  // Drop empty filter values so the URL stays clean.
  validateSearch: (raw: Record<string, unknown>): TodosSearch => {
    const q = typeof raw.q === "string" ? raw.q.trim() : "";
    const subject = typeof raw.subject === "string" ? raw.subject : undefined;
    const objective =
      typeof raw.objective === "string" ? raw.objective : undefined;
    const page = pageParam(raw.page);
    return {
      ...(q ? { q } : {}),
      ...(subject ? { subject } : {}),
      ...(objective ? { objective } : {}),
      ...(page ? { page } : {}),
    };
  },
  loader: ({ abortController }) =>
    listTodos({ signal: abortController.signal }),
  errorComponent: TodosLoadError,
  component: RouteComponent,
});

function TodosLoadError() {
  return (
    <TodosPage>
      <p className="text-sm text-muted-foreground">
        Todos could not be loaded. Try again shortly.
      </p>
    </TodosPage>
  );
}

type TodosPageProps = {
  children: React.ReactNode;
  aside?: React.ReactNode;
};

const TodosPage = ({ children, aside }: TodosPageProps) => {
  return (
    <div className="mx-auto max-w-[1280px] bg-background">
      <div className="px-8 py-8 lg:px-16">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            Guides Waiting To Be Written
          </h1>
          {aside}
        </div>

        <Separator className="mb-4 bg-border" />

        {children}
      </div>
    </div>
  );
};

function RouteComponent() {
  const { q, subject, objective, page = 1 } = Route.useSearch();
  const todos = Route.useLoaderData();
  const navigate = useNavigate({ from: Route.fullPath });

  const filteredTodos = useMemo(
    () => filterTodos(todos, { q, subject, objective }),
    [todos, q, subject, objective]
  );
  const groups = useMemo(
    () => groupTodosByTitle(filteredTodos),
    [filteredTodos]
  );

  const subjectItems = useMemo(() => subjectFilterItems(todos), [todos]);
  const objectiveItems = useMemo(() => objectiveFilterItems(todos), [todos]);

  const setFilters = (filters: Partial<TodoFilters>) =>
    navigate({
      search: (prev) => ({
        ...prev,
        ...filters,
        page: undefined,
      }),
    });

  const filterMenu = (
    <TodoFilterMenu
      q={q}
      subject={subject}
      objective={objective}
      subjectItems={subjectItems}
      objectiveItems={objectiveItems}
      onChange={setFilters}
    />
  );

  const {
    page: activePage,
    totalPages,
    pageRows,
    goToPage,
    toFirst,
    onPrevious,
    onNext,
    toLast,
  } = usePagination(groups, PAGE_SIZE, {
    page,
    onPageChange: (p) => navigate({ search: (prev) => ({ ...prev, page: p }) }),
  });

  if (groups.length === 0) {
    return (
      <TodosPage aside={filterMenu}>
        <Empty>
          <EmptyHeader>
            <EmptyMedia>
              <img
                src="/assets/adam/adam-cube-error.png"
                alt="Adam mascot indicating no todo guides"
                className="h-40 w-40 grayscale sm:h-56 sm:w-56"
              />
            </EmptyMedia>
            <EmptyTitle className="data-label">No todo guides</EmptyTitle>
            <EmptyDescription className="data-value">
              No todo guides right now.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </TodosPage>
    );
  }

  // A hand-typed or stale page number lands past the end. Say so instead of
  // showing the empty-state copy, which reads like there is nothing to browse.
  if (page > totalPages) {
    return (
      <TodosPage aside={filterMenu}>
        <p className="text-sm text-muted-foreground">
          Page {page} is past the last page.{" "}
          <Link
            to="/todos"
            search={{
              page: 1,
              ...(q ? { q } : {}),
              ...(subject ? { subject } : {}),
              ...(objective ? { objective } : {}),
            }}
            className="underline underline-offset-4"
          >
            Back to page 1
          </Link>
        </p>
      </TodosPage>
    );
  }

  return (
    <TodosPage aside={filterMenu}>
      <section className="grid gap-6 py-4 md:grid-cols-2">
        {pageRows.map((group) => (
          <TodoCard key={group.key} todo={group} />
        ))}
      </section>

      {totalPages > 1 && (
        <div className="mt-8 mb-4">
          <Pagination
            activePageNo={activePage}
            onPageSelect={goToPage}
            toFirst={toFirst}
            onPrevious={onPrevious}
            onNext={onNext}
            toLast={toLast}
            totalPages={totalPages}
          />
        </div>
      )}
    </TodosPage>
  );
}
