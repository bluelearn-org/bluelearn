import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import type { SubjectReference } from "@/types/subjects";
import type { GuideType, HydratedGuide } from "@/types/guides";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components//ui/badge";

import { formatDuration } from "@/lib/guideUtils";

type PropTypes = {
  guide: HydratedGuide;
  guideType?: GuideType;
};

export const GuideReader = ({ guide, guideType }: PropTypes) => {
  return (
    <>
      <header className="mb-5">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-[-0.04em]">
            {guide.title}
          </h1>
          {guideType && (
            <Badge
              key={guideType}
              variant="outline"
              className="mono-micro rounded-full border bg-badge tracking-[0.08em] text-badge-foreground"
            >
              {guideType}
            </Badge>
          )}
        </div>

        <div className="mono-micro mt-3">
          {guide.author} | {guide.created_at} | {formatDuration(guide.duration)}
        </div>

        <div className="mt-4 flex gap-2">
          {guide.tags.map((tag: SubjectReference) => (
            <Badge
              key={tag.slug}
              variant="outline"
              className="mono-micro rounded-full border bg-badge tracking-[0.08em] text-badge-foreground"
            >
              {tag.name}
            </Badge>
          ))}
        </div>
      </header>

      <Separator className="mb-8" />

      <article className="markdown">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
        >
          {guide.content}
        </ReactMarkdown>
      </article>
    </>
  );
};
