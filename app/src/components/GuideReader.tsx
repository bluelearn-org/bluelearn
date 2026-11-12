import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkDirective from "remark-directive";

import { Calendar, Clock, ShieldCheck, User } from "lucide-react";
import { createElement, useMemo } from "react";
import type { Components } from "react-markdown";
import type { ComponentType, ReactElement, ReactNode } from "react";
import type { Guide } from "@bluelearn/schemas";
import type { GuideType } from "@/types/guides";
import type { ReviewBlockProperties } from "@/lib/rehypeReviewBlocks";
import { remarkIndentedCodeAsParagraph } from "@/lib/remarkIndentedCodeAsParagraph";
import { rehypeReviewBlocks } from "@/lib/rehypeReviewBlocks";
import { remarkCallout } from "@/lib/remarkCallout";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/Callout";
import { GuideToc } from "@/components/GuideToc";

import { formatDate, formatDuration, getHeadingId } from "@/lib/guideUtils";

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    img: [...(defaultSchema.attributes?.img ?? []), "width", "height"],
    callout: ["type"],
  },
  tagNames: [...(defaultSchema.tagNames ?? []), "callout", "u"],
};

type ReaderTag = { id?: string; slug?: string; name: string };

export type ReaderGuide = Omit<
  Guide,
  "tags" | "variant_id" | "is_official" | "knowledge_type"
> & {
  tags: Array<ReaderTag>;
};

export type GuideBlockProps = ReviewBlockProperties & { children?: ReactNode };

type PropTypes = {
  guide: ReaderGuide;
  guideType?: GuideType;
  showToc?: boolean;
  isOfficial?: boolean;
  // Wraps each top-level body block. The review page hangs passage comments
  // under the block they quote.
  BlockWrapper?: ComponentType<GuideBlockProps>;
};

type GuideMarkdownProps = {
  markdown: string;
  // Comment bodies render inside the guide page, so their headings must not
  // take the ids that the table of contents links to.
  anchorHeadings?: boolean;
  BlockWrapper?: ComponentType<GuideBlockProps>;
};

// The sanitizing renderer for guide bodies and review comments.
export const GuideMarkdown = ({
  markdown,
  anchorHeadings = true,
  BlockWrapper,
}: GuideMarkdownProps) => {
  // Only the block wrapper keeps its component across renders, so paragraphs
  // stay mounted. Headings, code blocks, and callouts remount on each render.
  const blockComponents = useMemo(
    () =>
      BlockWrapper
        ? {
            "review-block": ({
              node,
              children,
            }: {
              node?: { properties: ReviewBlockProperties };
              children?: ReactNode;
            }) => (
              <BlockWrapper
                index={node!.properties.index}
                start={node!.properties.start}
                end={node!.properties.end}
              >
                {children}
              </BlockWrapper>
            ),
          }
        : {},
    [BlockWrapper]
  );

  const headingIds = new Map<string, number>();

  const renderHeading =
    (level: number) =>
    ({ children }: any) => {
      const getText = (value: any): string => {
        if (value == null) {
          return "";
        }

        if (typeof value === "string" || typeof value === "number") {
          return String(value);
        }

        if (Array.isArray(value)) {
          return value.map(getText).join("");
        }

        if (value?.props?.children != null) {
          return getText(value.props.children);
        }

        return "";
      };

      const text = getText(children);

      return createElement(
        `h${level}`,
        { id: getHeadingId(text.trim(), headingIds) },
        children
      );
    };

  const headingComponents = anchorHeadings
    ? {
        h1: renderHeading(1),
        h2: renderHeading(2),
        h3: renderHeading(3),
        h4: renderHeading(4),
        h5: renderHeading(5),
        h6: renderHeading(6),
      }
    : {};

  // Its own literal: inside a spread object the custom callout key could slip
  // past the excess-property check that the expect-error below relies on.
  const baseComponents: Components = {
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
    // @ts-expect-error custom component callout
    callout({ node, children, ...props }: any) {
      return <Callout type={props.type}>{children}</Callout>;
    },
  };

  return (
    <ReactMarkdown
      remarkPlugins={[
        remarkGfm,
        remarkMath,
        remarkDirective,
        remarkCallout,
        remarkIndentedCodeAsParagraph,
      ]}
      rehypePlugins={[
        rehypeRaw,
        [rehypeSanitize, sanitizeSchema],
        rehypeKatex,
        ...(BlockWrapper ? [rehypeReviewBlocks] : []),
      ]}
      components={{
        ...headingComponents,
        ...baseComponents,
        ...blockComponents,
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
};

export const GuideReader = ({
  guide,
  guideType,
  showToc = false,
  isOfficial = false,
  BlockWrapper,
}: PropTypes) => {
  const created = new Date(guide.created_at);
  const createdLabel = Number.isNaN(created.getTime())
    ? guide.created_at
    : formatDate(created);

  return (
    <>
      <header className="mb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            {showToc && <GuideToc body={guide.body ?? ""} />}
            <h1 className="text-3xl font-bold">{guide.title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isOfficial && (
              <Badge
                variant="outline"
                className="mono-micro h-6 shrink-0 gap-0.5 rounded-full border border-badge-border bg-transparent tracking-[0.08em] text-primary [&>svg]:size-[18px]!"
              >
                <ShieldCheck
                  className="fill-primary text-background"
                  strokeWidth={2.5}
                />
                <span className="translate-y-[0.25px]">Official</span>
              </Badge>
            )}
            {guideType && (
              <Badge
                key={guideType}
                variant="outline"
                className="mono-micro shrink-0 rounded-full border bg-badge tracking-[0.08em] text-badge-foreground"
              >
                {guideType}
              </Badge>
            )}
          </div>
        </div>

        <div className="mono-micro my-2 flex flex-wrap items-center gap-2.5 text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="h-3 w-3 text-muted-foreground/75" />@
            {guide.author ?? "deleted_user"}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-muted-foreground/75" />
            {createdLabel}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-muted-foreground/75" />
            {formatDuration(guide.duration_minutes)}
          </span>
        </div>

        {guide.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {guide.tags.map((tag: ReaderTag) => (
              <Badge
                key={tag.id ?? tag.slug ?? tag.name}
                variant="outline"
                className="mono-micro rounded-full border bg-badge tracking-[0.08em] text-badge-foreground"
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        )}

        {guide.summary && (
          <p className="mt-3 text-sm whitespace-pre-line text-muted-foreground">
            {guide.summary}
          </p>
        )}
      </header>

      <Separator className="mb-8" />

      <article className="markdown">
        <GuideMarkdown
          markdown={guide.body ?? ""}
          BlockWrapper={BlockWrapper}
        />
      </article>
    </>
  );
};
