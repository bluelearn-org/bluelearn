// remark pre processes markdown, rehype changes generated html
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkDirective from "remark-directive";

import type { ReactNode } from "react";

import { remarkCallout } from "@/lib/remarkCallout";
import { remarkIndentedCodeAsParagraph } from "@/lib/remarkIndentedCodeAsParagraph";
import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/Callout";
import { rehypeHeadingIds } from "@/components/blue_markdown/utils";

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    img: [...(defaultSchema.attributes?.img ?? []), "width", "height"],
    callout: ["type"],
  },
  tagNames: [...(defaultSchema.tagNames ?? []), "callout", "u"],
};

type BlueMarkdownProps = {
  body: string;
  className?: string;
};

const components = {
  pre({ children }: { children?: ReactNode }) {
    const child = Array.isArray(children) ? children[0] : children;

    if (!child || typeof child !== "object" || !("props" in child)) {
      return <pre>{children}</pre>;
    }

    const code = String(child.props.children ?? "").replace(/\n$/, "");
    const language = child.props.className?.replace("language-", "");

    return <CodeBlock code={code} language={language} />;
  },

  code({ children, className }: { children?: ReactNode; className?: string }) {
    if (className) {
      return <code className={className}>{children}</code>;
    }

    return (
      <code className="rounded bg-muted px-1 py-0.5 font-mono">{children}</code>
    );
  },

  callout({ children, ...props }: any) {
    return <Callout type={props.type}>{children}</Callout>;
  },
};

export function BlueMarkdown({ body, className }: BlueMarkdownProps) {
  return (
    <article className={className ? `markdown ${className}` : "markdown"}>
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
          rehypeHeadingIds,
        ]}
        components={components}
      >
        {body}
      </ReactMarkdown>
    </article>
  );
}
