import { Link } from "@tanstack/react-router";

import type { TodoGroup } from "@/lib/groupTodos";
import { Route as GuideRoute } from "@/routes/guides/$slug/index";
import { Route as ObjectiveRoute } from "@/routes/objectives/$slug/index";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type PropTypes = {
  todo: TodoGroup;
};

const requestLabel = (count: number) =>
  count === 1 ? "1 request" : `${count} requests`;

const requestedByLabel = (requestedBy: TodoGroup["requestedBy"]) => {
  if (requestedBy.some((requester) => requester.kind === "objective")) {
    return "Requested by:";
  }

  return requestedBy.length === 1
    ? "Requested by 1 guide:"
    : `Requested by ${requestedBy.length} guides:`;
};

const claimNotice = (count: number) =>
  count === 1
    ? "Someone is currently drafting a guide for this topic."
    : `${count} people are currently drafting a guide for this topic.`;

export const TodoCard = ({ todo }: PropTypes) => {
  return (
    <Link
      to="/contribute"
      search={{
        todoTitle: todo.title,
        todoSummary: todo.summary,
        todos: todo.todoIds.join(","),
      }}
      className="block min-w-0"
    >
      <Card className="group h-full rounded-md bg-background shadow-none transition-colors hover:bg-muted">
        <CardHeader className="min-w-0 p-6">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
              Todo
            </p>
            <Badge
              variant="default"
              className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
            >
              {requestLabel(todo.todoIds.length)}
            </Badge>
          </div>

          <h3 className="line-clamp-2 text-xl font-semibold tracking-tight">
            {todo.title}
          </h3>

          {todo.summary && (
            <p className="line-clamp-3 text-sm text-muted-foreground">
              {todo.summary}
            </p>
          )}
        </CardHeader>

        <CardContent className="border-t p-6">
          {todo.requestedBy.length > 0 && (
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-sm">{requestedByLabel(todo.requestedBy)}</p>
              <ul className="flex list-disc flex-col gap-1 pl-5">
                {todo.requestedBy.slice(0, 3).map((requester) => (
                  <li
                    key={`${requester.kind}:${requester.slug}`}
                    className="min-w-0 marker:text-muted-foreground"
                  >
                    <Link
                      to={
                        requester.kind === "guide"
                          ? GuideRoute.to
                          : ObjectiveRoute.to
                      }
                      params={{ slug: requester.slug }}
                      className="block max-w-full truncate text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {requester.title ?? requester.slug}
                    </Link>
                  </li>
                ))}

                {todo.requestedBy.length > 3 && (
                  <li className="list-none text-sm text-muted-foreground">
                    +{todo.requestedBy.length - 3} more
                  </li>
                )}
              </ul>

              {todo.claimCount > 0 && (
                <p className="pt-2 text-sm text-muted-foreground">
                  {claimNotice(todo.claimCount)} You can still create one if you
                  think yours will be different.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
};
