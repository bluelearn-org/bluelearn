import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MDXEditor,
  NestedLexicalEditor,
  codeBlockPlugin,
  codeMirrorPlugin,
  directivesPlugin,
  headingsPlugin,
  imagePlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
} from "@mdxeditor/editor";
import { toast } from "sonner";
import { Callout } from "../../Callout";

import { mathPlugin } from "./MathLivePlugin";
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
  const [overlayContainer, setOverlayContainer] = useState<HTMLElement | null>(
    null
  );

  const editorRef = useRef<MDXEditorMethods>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onUploadImageRef = useRef(onUploadImage);
  onUploadImageRef.current = onUploadImage;
  const latestRef = useRef<string | null>(null);

  // debounce so we don't re-render the flow on every keystroke
  const handleMarkdownChange = useCallback((newMarkdown: string) => {
    latestRef.current = newMarkdown;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      onChangeRef.current?.(newMarkdown);
      saveTimeoutRef.current = null;
    }, 1000);
  }, []);

  // If the user clicks away (e.g., clicking "Save Draft" or "Next"),
  // immediately flush any pending debounced state to the parent
  // so that the button click handlers see the freshest data.
  const handleBlur = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
      if (latestRef.current !== null) {
        onChangeRef.current?.(latestRef.current);
      }
    }
  }, []);

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

  const CalloutDirectiveDescriptor = useMemo(
    () => ({
      name: "callout",
      testNode(node: any) {
        return ["note", "tip", "danger", "info", "caution", "warning"].includes(
          node.name
        );
      },
      attributes: [],
      hasChildren: true,
      Editor: (props: any) => {
        return (
          <Callout type={props.mdastNode.name}>
            <NestedLexicalEditor
              block
              getContent={(node) => (node as any).children}
              getUpdatedMdastNode={(mdastNode, children) => ({
                ...mdastNode,
                children: children as any,
              })}
            />
          </Callout>
        );
      },
    }),
    []
  );

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
      directivesPlugin({ directiveDescriptors: [CalloutDirectiveDescriptor] }),
      mathPlugin(),
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
    <div
      id="bluelearn-editor-container"
      className="editor-only-container transition-all"
    >
      <div className="editor-only-paper flex flex-col">
        {overlayContainer && (
          <MDXEditor
            ref={editorRef}
            markdown={initialMarkdown}
            onChange={handleMarkdownChange}
            onBlur={handleBlur}
            contentEditableClassName="mdxeditor-content"
            placeholder="What will you teach the world today? Start typing here..."
            plugins={plugins}
            overlayContainer={overlayContainer}
          />
        )}
      </div>
      <div id="editor-portal-root" ref={setOverlayContainer} />
    </div>
  );
}
