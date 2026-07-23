import { useEffect, useMemo, useRef, useState } from "react";
import {
  MDXEditor,
  codeBlockPlugin,
  codeMirrorPlugin,
  headingsPlugin,
  imagePlugin,
  jsxPlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  useMdastNodeUpdater,
} from "@mdxeditor/editor";
import { toast } from "sonner";

import { MathLiveComponent, mathShortcutsPlugin } from "./MathLivePlugin";
import EditorToolbar from "./EditorToolbar";
import type { MDXEditorMethods } from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import "./Editor.css";

type EditorProps = {
  // Markdown to open with, e.g. when resuming a draft.
  value?: string;
  onChange?: (markdown: string) => void;
  onUploadImage?: (file: File) => Promise<string>;
};

export default function Editor({
  value,
  onChange,
  onUploadImage,
}: EditorProps) {
  const [initialMarkdown] = useState<string>(() => value ?? "");

  const editorRef = useRef<MDXEditorMethods>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onUploadImageRef = useRef(onUploadImage);
  onUploadImageRef.current = onUploadImage;
  const latestRef = useRef<string | null>(null);

  // debounce so we don't re-render the flow on every keystroke
  const handleMarkdownChange = (newMarkdown: string) => {
    latestRef.current = newMarkdown;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      onChangeRef.current?.(newMarkdown);
      saveTimeoutRef.current = null;
    }, 1000);
  };

  // Force a save on a pending edit if user leaves before the debounce fires
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        if (latestRef.current !== null) {
          onChangeRef.current?.(latestRef.current);
        }
      }
    };
  }, []);

  // Stable plugins configuration to avoid rebuilding Lexical instance during state re-renders
  const plugins = useMemo(
    () => [
      headingsPlugin({
        allowedHeadingLevels: [2, 3, 4, 5, 6],
      }),
      listsPlugin(),
      quotePlugin(),
      thematicBreakPlugin(),
      markdownShortcutPlugin(),
      linkPlugin(),
      linkDialogPlugin(),
      tablePlugin(),
      imagePlugin({
        EditImageToolbar: () => null,
        imageUploadHandler: (file) =>
          onUploadImageRef.current
            ? onUploadImageRef.current(file)
            : Promise.reject(new Error("Image upload is not available")),
      }),
      codeBlockPlugin({
        defaultCodeBlockLanguage: "javascript",
      }),
      codeMirrorPlugin({
        codeBlockLanguages: {
          text: "Plain Text",
          javascript: "JavaScript",
          typescript: "TypeScript",
          html: "HTML",
          css: "CSS",
          c: "C",
          cpp: "C++",
          java: "Java",
          python: "Python",
          markdown: "Markdown",
        },
      }),
      mathShortcutsPlugin(),
      jsxPlugin({
        jsxComponentDescriptors: [
          {
            name: "Math",
            kind: "text",
            props: [
              { name: "latex", type: "string" },
              { name: "inline", type: "expression" },
            ],
            hasChildren: false,
            Editor: (props) => {
              const updateMdastNode = useMdastNodeUpdater();
              const handleChange = (newLatex: string) => {
                const inlineAttr = props.mdastNode.attributes.find(
                  (a: any) => a.name === "inline"
                );
                const isInline =
                  inlineAttr &&
                  typeof inlineAttr === "object" &&
                  "value" in inlineAttr &&
                  inlineAttr.value != null
                    ? inlineAttr.value === "true" ||
                      (typeof inlineAttr.value === "object" &&
                        (inlineAttr.value as any).value === "true")
                    : false;

                updateMdastNode({
                  attributes: [
                    { type: "mdxJsxAttribute", name: "latex", value: newLatex },
                    {
                      type: "mdxJsxAttribute",
                      name: "inline",
                      value: {
                        type: "mdxJsxAttributeValueExpression",
                        value: isInline ? "true" : "false",
                      },
                    },
                  ],
                });
              };
              const latexAttr = props.mdastNode.attributes.find(
                (a: any) => a.name === "latex"
              );
              const inlineAttr = props.mdastNode.attributes.find(
                (a: any) => a.name === "inline"
              );
              const isInline =
                inlineAttr &&
                typeof inlineAttr === "object" &&
                "value" in inlineAttr &&
                inlineAttr.value != null
                  ? inlineAttr.value === "true" ||
                    (typeof inlineAttr.value === "object" &&
                      (inlineAttr.value as any).value === "true")
                  : false;

              return (
                <MathLiveComponent
                  latex={
                    latexAttr &&
                    typeof latexAttr === "object" &&
                    typeof latexAttr.value === "string"
                      ? latexAttr.value
                      : ""
                  }
                  inline={isInline}
                  onChange={handleChange}
                />
              );
            },
          },
        ],
      }),
      toolbarPlugin({
        toolbarContents: () => (
          <EditorToolbar
            editorRef={editorRef}
            onH1Attempted={() => {
              toast.warning("Heading 1 is Reserved for the Guide's Title", {
                description:
                  "We have automatically converted it to Heading 2 (##) to keep your formatting clean.",
                duration: 8000,
              });
            }}
          />
        ),
      }),
    ],
    []
  );

  return (
    <div className="editor-only-container">
      <div className="editor-only-paper">
        <MDXEditor
          ref={editorRef}
          markdown={initialMarkdown}
          onChange={handleMarkdownChange}
          contentEditableClassName="mdxeditor-content"
          placeholder="What will you teach the world today? Start typing here..."
          plugins={plugins}
        />
      </div>
    </div>
  );
}
