import { useMemo } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { paginationSchema } from "@bluelearn/schemas";

import { Separator } from "@/components/ui/separator";
import { TodoCard } from "@/components/cards/TodoCard";
import { Pagination } from "@/components/Pagination";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

import { listTodos } from "@/lib/api/todos";
import { groupTodosByTitle } from "@/lib/groupTodos";
import { usePagination } from "@/lib/usePagination";

const PAGE_SIZE = 10;

export const Route = createFileRoute("/todos")({
  validateSearch: paginationSchema.pick({ page: true }),
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
};

const TodosPage = ({ children }: TodosPageProps) => {
  return (
    <div className="mx-auto max-w-[1280px] bg-background">
      <div className="px-8 py-8 lg:px-16">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            Guides Waiting To Be Written
          </h1>
        </div>

        <Separator className="mb-4 bg-border" />

        {children}
      </div>
    </div>
  );
};

function RouteComponent() {
  const { page } = Route.useSearch();
  const todos = Route.useLoaderData();
  const navigate = useNavigate();

  const groups = useMemo(() => groupTodosByTitle(todos), [todos]);

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
    onPageChange: (p) => navigate({ to: "/todos", search: { page: p } }),
  });

  if (groups.length === 0) {
    return (
      <TodosPage>
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
      <TodosPage>
        <p className="text-sm text-muted-foreground">
          Page {page} is past the last page.{" "}
          <Link
            to="/todos"
            search={{ page: 1 }}
            className="underline underline-offset-4"
          >
            Back to page 1
          </Link>
        </p>
      </TodosPage>
    );
  }

  return (
    <TodosPage>
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
