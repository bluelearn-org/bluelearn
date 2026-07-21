import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import type { SubjectReference } from "@/types/subjects";
import type { GuideType, HydratedGuide } from "@/types/guides";
import type { ReactElement } from "react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components//ui/badge";
import { CodeBlock } from "@/components/CodeBlock";

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
          <h1 className="text-3xl font-bold">{guide.title}</h1>
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

        <div className="mono-micro py-2 text-muted-foreground">
          {guide.author} | {guide.created_at} | {formatDuration(guide.duration)}
        </div>

        <div className="flex gap-2">
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

        <div>
          <p className="py-4 text-sm whitespace-pre-line text-muted-foreground">
            {guide.summary}
          </p>
        </div>
      </header>

      <Separator className="mb-8" />

      <article className="markdown">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            pre({ children }) {
              const child = children as ReactElement<{
                className?: string;
                children?: React.ReactNode;
              }>;

              const code = String(child.props.children).replace(/\n$/, "");
              const language = child.props.className?.replace("language-", "");

              return <CodeBlock code={code} language={language} />;
            },

            code({ children, className }) {
              if (className) {
                return <code className={className}>{children}</code>;
              }

              return (
                <code className="rounded bg-muted px-1 py-0.5 font-mono">
                  {children}
                </code>
              );
            },
          }}
        >
          {guide.content}
        </ReactMarkdown>
      </article>
    </>
  );
};
