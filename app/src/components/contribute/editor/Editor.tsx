import { useEffect, useRef, useState } from "react";
import {
    BlockTypeSelect,
    BoldItalicUnderlineToggles,
    CreateLink,
    InsertCodeBlock,
    InsertImage,
    InsertTable,
    InsertThematicBreak,
    ListsToggle,
    MDXEditor,
    UndoRedo,
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
import {
    InsertBlockMath,
    InsertInlineMath,
    mathPlugin,
} from "./math-plugin/index.tsx";
import type { MDXEditorMethods } from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import "./Editor.css";

export default function Editor() {
    const [markdown, setMarkdown] = useState<string>(() => {
        const saved = localStorage.getItem("mdx_studio_content");
        if (saved) return saved;
        return `# Thank you for Contributing to BlueLearn 👋

This is a clean, distraction-free markdown editing workspace. All changes are automatically saved locally.

### Try writing some Markdown:
- **Bold** or *Italic* text
- Create a list
- Insert code blocks, tables, links, or images using the toolbar above!

### LaTeX Math Integration:
Here is an inline equation: $e^{i\\pi} + 1 = 0$. Click on it to edit!

And a block math equation:
$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$
`;
    });

    const editorRef = useRef<MDXEditorMethods>(null);

    // Auto-save to localStorage
    useEffect(() => {
        localStorage.setItem("mdx_studio_content", markdown);
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
                                <div className="mdxeditor-toolbar-custom">
                                    <UndoRedo />
                                    <div className="mdx-toolbar-divider"></div>
                                    <BoldItalicUnderlineToggles />
                                    <div className="mdx-toolbar-divider"></div>
                                    <BlockTypeSelect />
                                    <div className="mdx-toolbar-divider"></div>
                                    <ListsToggle />
                                    <div className="mdx-toolbar-divider"></div>
                                    <InsertInlineMath />
                                    <InsertBlockMath />
                                    <div className="mdx-toolbar-divider"></div>
                                    <CreateLink />
                                    <InsertImage />
                                    <InsertTable />
                                    <InsertThematicBreak />
                                    <InsertCodeBlock />
                                </div>
                            ),
                        }),
                    ]}
                />
            </div>
        </div>
    );
}
