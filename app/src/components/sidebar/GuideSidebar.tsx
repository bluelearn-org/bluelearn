import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import type {
  Guide,
  GuideReference,
  TodoPrerequisiteReference,
} from "@bluelearn/schemas";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { Badge } from "@/components/ui/badge";
import { extractHeadings } from "@/lib/guideUtils";

type PropTypes = {
  guide: Omit<Guide, "variant_id" | "is_official" | "todo_prerequisites"> & {
    todo_prerequisites?: Array<TodoPrerequisiteReference>;
  };
  slug: string;
  sidebarActions?: React.ReactNode;
  reviewSection?: React.ReactNode;
  showPrerequisites?: boolean;
  showFollowUps?: boolean;
};

export const GuideSidebar = ({
  guide,
  slug,
  sidebarActions,
  reviewSection,
  showPrerequisites = true,
  showFollowUps = true,
}: PropTypes) => {
  const headings = useMemo(
    () => extractHeadings(guide.body ?? ""),
    [guide.body]
  );

  // Older API responses may not include todos during deployment.
  const todoPrerequisites = guide.todo_prerequisites ?? [];
  const prerequisiteCount =
    guide.prerequisites.length + todoPrerequisites.length;

  return (
    <aside className="hidden px-6 py-6 md:sticky md:top-[65px] md:block md:h-[calc(100vh-65px)] md:self-start md:overflow-y-auto md:border-r">
      {sidebarActions}

      {/* TOC */}
      <CollapsibleSection title="Table of Contents" defaultOpen={true}>
        <ul className="space-y-2">
          {headings.map((h, idx) => (
            <li
              key={idx}
              className="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
              style={{
                paddingLeft:
                  h.level === 1
                    ? 6
                    : h.level === 2
                      ? 12
                      : h.level === 3
                        ? 24
                        : h.level === 4
                          ? 36
                          : h.level === 5
                            ? 48
                            : 60,
              }}
            >
              <Link to="." hash={h.id} className="block w-full py-1">
                {h.text}
              </Link>
            </li>
          ))}
        </ul>
      </CollapsibleSection>

      {/* Prerequisites */}
      {showPrerequisites && (
        <CollapsibleSection defaultOpen={true} title="Prerequisites">
          {prerequisiteCount === 0 ? (
            <p
              className="text-xs text-muted-foreground"
              style={{ paddingLeft: 12 }}
            >
              None declared
            </p>
          ) : (
            <ul className="space-y-2">
              {guide.prerequisites.map((prereq: GuideReference) => (
                <li
                  key={prereq.slug}
                  className="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
                  style={{ paddingLeft: 12 }}
                >
                  <Link
                    to="/guides/$slug"
                    params={{ slug: prereq.slug }}
                    state={{
                      breadcrumbOrigin: {
                        type: "guide",
                        title: guide.title,
                        path: `/guides/${slug}`,
                      },
                    }}
                  >
                    {prereq.title}
                  </Link>
                </li>
              ))}

              {/* There's no guide to link to until the todo is resolved. */}
              {todoPrerequisites.map((todo: TodoPrerequisiteReference) => (
                <li
                  key={todo.id}
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                  style={{ paddingLeft: 12 }}
                  title={todo.summary}
                >
                  <span className="min-w-0 break-words">{todo.title}</span>
                  <Badge
                    variant="outline"
                    className="border-transparent bg-brand-bright-blue/15 font-mono tracking-[0.06em] text-brand-dark-navy uppercase dark:text-brand-bright-blue"
                  >
                    Todo
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CollapsibleSection>
      )}

      {/* Follow Ups */}
      {showFollowUps && (
        <CollapsibleSection defaultOpen={true} title="Follow Up Guides">
          {(guide.follow_ups ?? []).length === 0 ? (
            <p
              className="text-xs text-muted-foreground"
              style={{ paddingLeft: 12 }}
            >
              None declared
            </p>
          ) : (
            <ul className="space-y-2">
              {(guide.follow_ups ?? []).map((follow_up: GuideReference) => (
                <li
                  key={follow_up.slug}
                  className="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
                  style={{ paddingLeft: 12 }}
                >
                  <Link
                    to="/guides/$slug"
                    params={{ slug: follow_up.slug }}
                    state={{
                      breadcrumbOrigin: {
                        type: "guide",
                        title: guide.title,
                        path: `/guides/${slug}`,
                      },
                    }}
                  >
                    {follow_up.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CollapsibleSection>
      )}

      {reviewSection}
    </aside>
  );
};
