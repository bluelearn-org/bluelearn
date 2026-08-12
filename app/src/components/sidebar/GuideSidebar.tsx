import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import type { Guide, GuideReference } from "@bluelearn/schemas";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { extractHeadings } from "@/lib/guideUtils";

type PropTypes = {
  guide: Omit<Guide, "variant_id">;
  slug: string;
  sidebarActions?: React.ReactNode;
  reviewSection?: React.ReactNode;
  showPrerequisites?: boolean;
};

export const GuideSidebar = ({
  guide,
  slug,
  sidebarActions,
  reviewSection,
  showPrerequisites = true,
}: PropTypes) => {
  const headings = useMemo(
    () => extractHeadings(guide.body ?? ""),
    [guide.body]
  );

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
              <a href={`#${h.id}`} className="block w-full py-1">
                {h.text}
              </a>
            </li>
          ))}
        </ul>
      </CollapsibleSection>

      {/* Prerequisites */}
      {showPrerequisites && (
        <CollapsibleSection defaultOpen={true} title="Prerequisites">
          {guide.prerequisites.length === 0 ? (
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
            </ul>
          )}
        </CollapsibleSection>
      )}

      {reviewSection}
    </aside>
  );
};
