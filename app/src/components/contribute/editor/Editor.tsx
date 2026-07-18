import { useEffect, useMemo, useRef, useState } from "react";
import {
  MDXEditor,
  codeBlockPlugin,
  codeMirrorPlugin,
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

import { mathPlugin } from "./math-plugin/index.tsx";
import EditorToolbar from "./EditorToolbar.tsx";
import type { MDXEditorMethods } from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import "./Editor.css";

type EditorProps = {
  // Markdown to open with, e.g. when resuming a draft.
  value?: string;
  onChange?: (markdown: string) => void;
};

export default function Editor({ value, onChange }: EditorProps) {
  const [initialMarkdown] = useState<string>(() => value ?? "");

  const editorRef = useRef<MDXEditorMethods>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
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

  // flush a pending edit if we leave before the debounce fires
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
      imagePlugin(),
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
