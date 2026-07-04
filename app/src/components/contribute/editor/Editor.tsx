import { useEffect, useRef, useState } from "react";
import {
  $createImageNode,
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
  lexical,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
} from "@mdxeditor/editor";
import { $createLinkNode } from "@lexical/link";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  Check,
  ChevronDown,
  Code,
  Copy,
  Download,
  Image,
  Link as LinkIcon,
  Minus,
  Plus,
  Table,
  Upload,
} from "lucide-react";
import {
  InsertBlockMath,
  InsertInlineMath,
  mathPlugin,
} from "./math-plugin/index.tsx";
import type { MDXEditorMethods } from "@mdxeditor/editor";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import "@mdxeditor/editor/style.css";
import "./Editor.css";

function MarkdownLinkImageShortcutListener() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const {
      $getSelection,
      $isRangeSelection,
      $getNodeByKey,
      $isTextNode,
      $createRangeSelection,
      $setSelection,
      $insertNodes,
      $createTextNode,
    } = lexical;

    return editor.registerUpdateListener(
      ({ tags, dirtyLeaves, editorState }) => {
        if (
          tags.has("collaboration") ||
          tags.has("historic") ||
          editor.isComposing()
        ) {
          return;
        }

        editorState.read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;

          const anchorKey = selection.anchor.key;
          const anchorOffset = selection.anchor.offset;
          const anchorNode = $getNodeByKey(anchorKey);

          if (!$isTextNode(anchorNode) || !dirtyLeaves.has(anchorKey)) return;

          // Skip processing inside code blocks
          const parentNode = anchorNode.getParent();
          if (parentNode === null || parentNode.getType() === "code") return;

          const textContent = anchorNode.getTextContent();
          const textBeforeCursor = textContent.slice(0, anchorOffset);

          // 1. Match Image syntax: ![alt](url)
          const imageMatch = textBeforeCursor.match(
            /!\[([^\]]*)\]\(([^)]+)\)$/
          );
          if (imageMatch) {
            const fullMatchText = imageMatch[0];
            const altText = imageMatch[1];
            const src = imageMatch[2];
            const startOffset = anchorOffset - fullMatchText.length;

            editor.update(() => {
              const rangeSelection = $createRangeSelection();
              rangeSelection.anchor.set(
                anchorNode.getKey(),
                startOffset,
                "text"
              );
              rangeSelection.focus.set(
                anchorNode.getKey(),
                anchorOffset,
                "text"
              );
              $setSelection(rangeSelection);

              const imageNode = $createImageNode({ src, altText });
              $insertNodes([imageNode]);
            });
            return;
          }

          // 2. Match Link syntax: [text](url)
          const linkMatch = textBeforeCursor.match(/\[([^\]]+)\]\(([^)]+)\)$/);
          if (linkMatch) {
            const fullMatchText = linkMatch[0];
            const isImage = textBeforeCursor
              .slice(0, anchorOffset - fullMatchText.length)
              .endsWith("!");
            if (!isImage) {
              const text = linkMatch[1];
              const url = linkMatch[2];
              const startOffset = anchorOffset - fullMatchText.length;

              editor.update(() => {
                const rangeSelection = $createRangeSelection();
                rangeSelection.anchor.set(
                  anchorNode.getKey(),
                  startOffset,
                  "text"
                );
                rangeSelection.focus.set(
                  anchorNode.getKey(),
                  anchorOffset,
                  "text"
                );
                $setSelection(rangeSelection);

                const linkNode = $createLinkNode(url);
                const textNode = $createTextNode(text);
                linkNode.append(textNode);
                $insertNodes([linkNode]);
              });
              return;
            }
          }
        });
      }
    );
  }, [editor]);

  return null;
}

export default function Editor() {
  const [markdown, setMarkdown] = useState<string>(() => {
    const saved = localStorage.getItem("mdx_studio_content");
    if (saved) {
      return saved;
    }
    return `# Thank you for Contributing to BlueLearn 👋\n\nThis is a clean, distraction-free markdown editing workspace. All changes are automatically saved locally.\n\n### Try writing some Markdown:\n- **Bold** or *Italic* text\n- Create a list\n- Insert code blocks, tables, links, or images using the toolbar above!\n\n### LaTeX Math Integration:\nHere is an inline equation: $e^{i\\pi} + 1 = 0$. Click on it to edit!\n\nAnd a block math equation:\n$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$\n`;
  });

  const editorRef = useRef<MDXEditorMethods>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  // Refs for hidden native buttons to trigger programmatically from our custom Popovers
  const linkRef = useRef<HTMLSpanElement>(null);
  const imageRef = useRef<HTMLSpanElement>(null);
  const tableRef = useRef<HTMLSpanElement>(null);
  const thematicBreakRef = useRef<HTMLSpanElement>(null);
  const codeBlockRef = useRef<HTMLSpanElement>(null);
  const inlineMathRef = useRef<HTMLSpanElement>(null);
  const blockMathRef = useRef<HTMLSpanElement>(null);

  // Auto-save to localStorage with a 1-second debounce to prevent write blocking on every keystroke
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem("mdx_studio_content", markdown);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [markdown]);

  const handleDownload = () => {
    const content = editorRef.current?.getMarkdown() || markdown;
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "guide-contribution.md");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (typeof text === "string") {
        editorRef.current?.setMarkdown(text);
        setMarkdown(text);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleCopy = async () => {
    const content = editorRef.current?.getMarkdown() || markdown;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

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
                  <MarkdownLinkImageShortcutListener />
                  <UndoRedo />
                  <div className="mdx-toolbar-divider"></div>
                  <BoldItalicUnderlineToggles />
                  <div className="mdx-toolbar-divider"></div>
                  <BlockTypeSelect />
                  <div className="mdx-toolbar-divider"></div>
                  <ListsToggle />

                  <div className="mdx-toolbar-divider"></div>

                  {/* Math Dropdown using Popover */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="toolbar-dropdown-trigger"
                        title="Insert LaTeX Math Equation"
                      >
                        <span className="font-serif font-bold italic">
                          f(x)
                        </span>
                        <span>Math</span>
                        <ChevronDown className="h-3 w-3 opacity-60" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="toolbar-popover-content"
                      align="start"
                      onCloseAutoFocus={(e) => e.preventDefault()}
                    >
                      <div className="toolbar-popover-header">
                        LaTeX Equations
                      </div>
                      <button
                        type="button"
                        className="toolbar-popover-item"
                        onClick={() => {
                          editorRef.current?.focus();
                          inlineMathRef.current
                            ?.querySelector("button")
                            ?.click();
                        }}
                      >
                        <span className="w-4 text-center font-serif font-bold text-muted-foreground">
                          x
                        </span>
                        <span>Inline Equation</span>
                      </button>
                      <button
                        type="button"
                        className="toolbar-popover-item"
                        onClick={() => {
                          editorRef.current?.focus();
                          blockMathRef.current
                            ?.querySelector("button")
                            ?.click();
                        }}
                      >
                        <span className="w-4 text-center font-serif font-bold text-muted-foreground italic">
                          $$
                        </span>
                        <span>Block Equation</span>
                      </button>
                    </PopoverContent>
                  </Popover>

                  {/* Insert Dropdown using Popover */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="toolbar-dropdown-trigger"
                        title="Insert Element"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Insert</span>
                        <ChevronDown className="h-3 w-3 opacity-60" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="toolbar-popover-content"
                      align="start"
                      onCloseAutoFocus={(e) => e.preventDefault()}
                    >
                      <div className="toolbar-popover-header">Elements</div>
                      <button
                        type="button"
                        className="toolbar-popover-item"
                        onClick={() =>
                          tableRef.current?.querySelector("button")?.click()
                        }
                      >
                        <Table className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Table</span>
                      </button>
                      <button
                        type="button"
                        className="toolbar-popover-item"
                        onClick={() =>
                          codeBlockRef.current?.querySelector("button")?.click()
                        }
                      >
                        <Code className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Code Block</span>
                      </button>
                      <button
                        type="button"
                        className="toolbar-popover-item"
                        onClick={() =>
                          imageRef.current?.querySelector("button")?.click()
                        }
                      >
                        <Image className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Image</span>
                      </button>
                      <button
                        type="button"
                        className="toolbar-popover-item"
                        onClick={() =>
                          linkRef.current?.querySelector("button")?.click()
                        }
                      >
                        <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Link</span>
                      </button>
                      <div className="my-1 h-px bg-border" />
                      <button
                        type="button"
                        className="toolbar-popover-item"
                        onClick={() =>
                          thematicBreakRef.current
                            ?.querySelector("button")
                            ?.click()
                        }
                      >
                        <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Horizontal Line</span>
                      </button>
                    </PopoverContent>
                  </Popover>

                  <div className="mdx-toolbar-divider"></div>

                  {/* Actions & Sharing Button Group */}
                  <div className="flex items-center gap-1 bg-card p-0.5">
                    <button
                      type="button"
                      onClick={handleCopy}
                      title="Copy Markdown to Clipboard"
                      aria-label="Copy Markdown to Clipboard"
                    >
                      {copied ? <Check className="text-green-500" /> : <Copy />}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownload}
                      title="Download as .md file"
                      aria-label="Download as .md file"
                    >
                      <Download />
                    </button>
                    <button
                      type="button"
                      onClick={handleImportClick}
                      title="Import .md file"
                      aria-label="Import .md file"
                    >
                      <Upload />
                    </button>
                  </div>

                  {/* Hidden native MDXEditor buttons so they still receive their reactive contexts */}
                  <div style={{ display: "none" }}>
                    <span ref={tableRef}>
                      <InsertTable />
                    </span>
                    <span ref={imageRef}>
                      <InsertImage />
                    </span>
                    <span ref={codeBlockRef}>
                      <InsertCodeBlock />
                    </span>
                    <span ref={thematicBreakRef}>
                      <InsertThematicBreak />
                    </span>
                    <span ref={linkRef}>
                      <CreateLink />
                    </span>
                    <span ref={inlineMathRef}>
                      <InsertInlineMath />
                    </span>
                    <span ref={blockMathRef}>
                      <InsertBlockMath />
                    </span>
                  </div>
                </div>
              ),
            }),
          ]}
        />
      </div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".md"
        style={{ display: "none" }}
      />
    </div>
  );
}
