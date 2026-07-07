import { useEffect, useRef, useState } from "react";
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
import { mathPlugin } from "./math-plugin/index.tsx";
import EditorToolbar from "./EditorToolbar.tsx";
import type { MDXEditorMethods } from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import "./Editor.css";

export default function Editor() {
  const [markdown, setMarkdown] = useState<string>(() => {
    const saved = localStorage.getItem("mdx_studio_content");
    if (saved) {
      return saved;
    }
    return `# Thank you for Contributing to BlueLearn 👋\n\nThis is a clean, distraction-free markdown editing workspace. All changes are automatically saved locally.\n\n### Try writing some Markdown:\n- **Bold** or *Italic* text\n- Create a list\n- Insert code blocks, tables, links, or images using the toolbar above!\n\n### LaTeX Math Integration:\nHere is an inline equation: $e^{i\\pi} + 1 = 0$. Click on it to edit!\n\nAnd a block math equation:\n$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$\n`;
  });

  const editorRef = useRef<MDXEditorMethods>(null);

  // Auto-save to localStorage with a 1-second debounce to prevent write blocking on every keystroke
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem("mdx_studio_content", markdown);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [markdown]);

  return (
    <div className="editor-only-container">
      <div className="editor-only-paper">
        <MDXEditor
          ref={editorRef}
          markdown={markdown}
          onChange={setMarkdown}
          contentEditableClassName="mdxeditor-content"
          plugins={[
            headingsPlugin(),
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
                  markdown={markdown}
                  setMarkdown={setMarkdown}
                />
              ),
            }),
          ]}
        />
      </div>
    </div>
  );
}
