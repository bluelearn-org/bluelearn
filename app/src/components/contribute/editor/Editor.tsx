import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MDXEditor,
  NestedLexicalEditor,
  codeBlockPlugin,
  codeMirrorPlugin,
  diffSourcePlugin,
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
  // The guide flow waits for a pause in typing. A short form submits right
  // after an edit, and a tap on iOS does not always blur the editor first.
  changeDelayMs?: number;
  mode?: "guide" | "review";
};

export default function Editor({
  value,
  onChange,
  onUploadImage,
  changeDelayMs = 1000,
  mode = "guide",
}: EditorProps) {
  const [initialMarkdown] = useState<string>(() => value ?? "");
  const [markdown, setMarkdown] = useState<string>(() => value ?? "");
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
  const handleMarkdownChange = useCallback(
    (newMarkdown: string) => {
      setMarkdown(newMarkdown);
      latestRef.current = newMarkdown;

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        onChangeRef.current?.(newMarkdown);
        saveTimeoutRef.current = null;
      }, changeDelayMs);
    },
    [changeDelayMs]
  );

  // MDXEditor's imperative setMarkdown() does NOT fire the editor's onChange,
  // so an imported file would otherwise never reach `markdown` or the parent's
  // `body` - the content would render in Lexical but be dropped on the next
  // remount (e.g. the Preview step round trip). Propagate it explicitly, and
  // skip the debounce since an import is a single deliberate action.
  const handleImportMarkdown = useCallback((newMarkdown: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    setMarkdown(newMarkdown);
    latestRef.current = newMarkdown;
    onChangeRef.current?.(newMarkdown);
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
  // Note: changes to markdown, mode, or overlayContainer recreate this configuration.
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
      diffSourcePlugin({ viewMode: "rich-text" }),
      toolbarPlugin({
        toolbarContents: () => (
          <EditorToolbar
            editorRef={editorRef}
            overlayContainer={overlayContainer}
            mode={mode}
            markdown={markdown}
            onImportMarkdown={handleImportMarkdown}
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
    [markdown, mode, overlayContainer]
  );

  return (
    <div
      id="bluelearn-editor-container"
      className={
        mode === "review"
          ? "editor-only-container editor-review"
          : "editor-only-container transition-all"
      }
    >
      <div className="editor-only-paper flex flex-col">
        {overlayContainer && (
          <MDXEditor
            ref={editorRef}
            className={mode === "review" ? "review-comment-editor" : undefined}
            markdown={initialMarkdown}
            onChange={handleMarkdownChange}
            onBlur={handleBlur}
            contentEditableClassName="mdxeditor-content"
            placeholder={
              mode === "review"
                ? "Propose an edit..."
                : "What will you teach the world today? Start typing here..."
            }
            plugins={plugins}
            overlayContainer={overlayContainer}
          />
        )}
      </div>
      <div id="editor-portal-root" ref={setOverlayContainer} />
    </div>
  );
}
