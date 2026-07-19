import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { CollapsibleSection } from "./CollapsibleSection";
import type { GuideReference, HydratedGuide } from "@/types/guides";
import type { LucideIcon } from "lucide-react";
import { extractHeadings } from "@/lib/guideUtils";

export type Action = {
  icon: LucideIcon;
  label: string;
};

type PropTypes = {
  guide: HydratedGuide;
  slug: string;
  sidebarActions?: React.ReactNode;
  reviewSection?: React.ReactNode;
};

export const Sidebar = ({
  guide,
  slug,
  sidebarActions,
  reviewSection,
}: PropTypes) => {
  const headings = useMemo(
    () => extractHeadings(guide.content),
    [guide.content]
  );

  return (
    <aside className="h-[calc(100vh-70px)] overflow-y-auto border-r px-6 py-6">
      {sidebarActions}

      {/* Prerequisites */}
      <CollapsibleSection
        title={<p className="ml-auto">Prerequisites</p>}
        defaultOpen={true}
      >
        <ul className="space-y-2">
          {guide.prerequisites.map((prereq: GuideReference) => (
            <li
              key={prereq.slug}
              className="text-sm text-muted-foreground hover:text-foreground"
              style={{
                paddingLeft: 6,
              }}
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
      </CollapsibleSection>

      {/* TOC */}
      <CollapsibleSection
        title={<p className="ml-auto">Table of Contents</p>}
        defaultOpen={true}
      >
        <ul className="space-y-2">
          {headings.map((h, idx) => (
            <li
              key={idx}
              className="cursor-pointer text-sm text-muted-foreground hover:text-foreground"
              style={{
                paddingLeft:
                  h.level === 1
                    ? 6
                    : h.level === 2
                      ? 12
                      : h.level === 3
                        ? 24
                        : 28,
              }}
            >
              {h.text}
            </li>
          ))}
        </ul>
      </CollapsibleSection>

      {reviewSection}
    </aside>
  );
};
