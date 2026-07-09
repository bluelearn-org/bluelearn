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

export default function Editor() {
  const [initialMarkdown] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("mdx_studio_content");
      return saved || "";
    }
    return "";
  });

  const editorRef = useRef<MDXEditorMethods>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced auto-save function to write to localStorage directly from the editor's onChange
  // without triggering React state updates or parent component re-renders
  const handleMarkdownChange = (newMarkdown: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      localStorage.setItem("mdx_studio_content", newMarkdown);
    }, 1000);
  };

  // Clean up the save timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
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
