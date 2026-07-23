import React, { useRef, useState } from "react";
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CreateLink,
  InsertCodeBlock,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  UndoRedo,
} from "@mdxeditor/editor";
import {
  Check,
  ChevronDown,
  Code,
  Copy,
  Download,
  Link as LinkIcon,
  Minus,
  Plus,
  Table,
  Upload,
} from "lucide-react";
import { InsertBlockMath, InsertInlineMath } from "./math-plugin/index.tsx";
import MarkdownLinkImageShortcutListener from "./MarkdownLinkImageShortcutListener";
import H1RestrictionListener from "./H1RestrictionListener.tsx";
import CodeBlockShortcutListener from "./CodeBlockShortcutListener";
import type { MDXEditorMethods } from "@mdxeditor/editor";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface EditorToolbarProps {
  editorRef: React.RefObject<MDXEditorMethods | null>;
  onH1Attempted: () => void;
}

export default function EditorToolbar({
  editorRef,
  onH1Attempted,
}: EditorToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  // Refs for hidden native buttons to trigger programmatically from our custom Popovers
  const linkRef = useRef<HTMLSpanElement>(null);
  const tableRef = useRef<HTMLSpanElement>(null);
  const thematicBreakRef = useRef<HTMLSpanElement>(null);
  const codeBlockRef = useRef<HTMLSpanElement>(null);
  const inlineMathRef = useRef<HTMLSpanElement>(null);
  const blockMathRef = useRef<HTMLSpanElement>(null);

  const handleDownload = () => {
    const content = editorRef.current?.getMarkdown() || "";
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
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleCopy = async () => {
    const content = editorRef.current?.getMarkdown() || "";
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <div className="mdxeditor-toolbar-custom">
      <MarkdownLinkImageShortcutListener />
      <H1RestrictionListener onH1Attempted={onH1Attempted} />
      <CodeBlockShortcutListener />
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
            <span className="font-serif font-bold italic">f(x)</span>
            <span>Math</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="toolbar-popover-content"
          align="start"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <div className="toolbar-popover-header">LaTeX Equations</div>
          <button
            type="button"
            className="toolbar-popover-item"
            onClick={() => {
              editorRef.current?.focus();
              inlineMathRef.current?.querySelector("button")?.click();
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
              blockMathRef.current?.querySelector("button")?.click();
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
            onClick={() => tableRef.current?.querySelector("button")?.click()}
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
            onClick={() => linkRef.current?.querySelector("button")?.click()}
          >
            <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Link</span>
          </button>
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            className="toolbar-popover-item"
            onClick={() =>
              thematicBreakRef.current?.querySelector("button")?.click()
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
