import React, { useEffect, useRef, useState } from "react";
import {
  BoldItalicUnderlineToggles,
  CodeToggle,
  CreateLink,
  InsertCodeBlock,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  StrikeThroughSupSubToggles,
  UndoRedo,
  activePlugins$,
  allowedHeadingLevels$,
  convertSelectionToNode$,
  currentBlockType$,
  insertDirective$,
} from "@mdxeditor/editor";
import { useCellValue, usePublisher } from "@mdxeditor/gurx";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import { $createParagraphNode } from "lexical";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronDown,
  Code,
  Copy,
  Download,
  Eye,
  EyeOff,
  Info,
  Lightbulb,
  Link as LinkIcon,
  Maximize,
  Minimize,
  Minus,
  MoreHorizontal,
  Plus,
  Quote,
  Table,
  Type,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { InsertBlockMath, InsertInlineMath } from "./MathLivePlugin";
import MarkdownLinkImageShortcutListener from "./MarkdownLinkImageShortcutListener";
import H1RestrictionListener from "./H1RestrictionListener.tsx";
import CodeBlockShortcutListener from "./CodeBlockShortcutListener";
import CalloutShortcutListener from "./CalloutShortcutListener";
import TabShortcutListener from "./TabShortcutListener";
import IndentButtons from "./IndentButtons";
import type { HeadingTagType } from "@lexical/rich-text";
import type { MDXEditorMethods } from "@mdxeditor/editor";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";

function CustomBlockTypeSelect() {
  const [open, setOpen] = useState(false);
  const convertSelectionToNode = usePublisher(convertSelectionToNode$);
  const currentBlockType = useCellValue(currentBlockType$);
  const activePlugins = useCellValue(activePlugins$);
  const allowedHeadingLevels = useCellValue(allowedHeadingLevels$);

  const hasQuote = activePlugins.includes("quote");
  const hasHeadings = activePlugins.includes("headings");

  const getLabel = (type: string) => {
    switch (type) {
      case "h1":
        return "Heading 1";
      case "h2":
        return "Heading 2";
      case "h3":
        return "Heading 3";
      case "h4":
        return "Heading 4";
      case "h5":
        return "Heading 5";
      case "h6":
        return "Heading 6";
      case "quote":
        return "Quote";
      case "paragraph":
      default:
        return "Paragraph";
    }
  };

  const handleSelect = (type: string) => {
    setOpen(false);
    switch (type) {
      case "quote":
        convertSelectionToNode(() => $createQuoteNode());
        break;
      case "paragraph":
        convertSelectionToNode(() => $createParagraphNode());
        break;
      default:
        if (type.startsWith("h")) {
          convertSelectionToNode(() =>
            $createHeadingNode(type as HeadingTagType)
          );
        }
        break;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <PopoverTrigger asChild>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="toolbar-dropdown-trigger min-w-[100px] shrink-0 justify-between"
              aria-label="Select Block Type"
            >
              <span className="truncate text-xs font-medium">
                {getLabel(currentBlockType)}
              </span>
              <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-60" />
            </button>
          </TooltipTrigger>
        </PopoverTrigger>

        <TooltipContent>Select Block Type</TooltipContent>
      </Tooltip>

      <PopoverContent
        className="toolbar-popover-content w-40"
        align="start"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="toolbar-popover-header">Block Type</div>

        <button
          type="button"
          className={`toolbar-popover-item ${
            currentBlockType === "paragraph" || !currentBlockType
              ? "bg-accent font-semibold text-accent-foreground"
              : ""
          }`}
          onClick={() => handleSelect("paragraph")}
        >
          <Type className="h-3.5 w-3.5 opacity-70" />
          <span>Paragraph</span>
        </button>

        {hasHeadings &&
          allowedHeadingLevels.map((lvl) => {
            const hTag = `h${lvl}`;

            return (
              <button
                key={hTag}
                type="button"
                className={`toolbar-popover-item ${
                  currentBlockType === hTag
                    ? "bg-accent font-semibold text-accent-foreground"
                    : ""
                }`}
                onClick={() => handleSelect(hTag)}
              >
                <span className="w-3.5 text-center font-mono text-xs font-bold">
                  H{lvl}
                </span>
                <span>Heading {lvl}</span>
              </button>
            );
          })}

        {hasQuote && (
          <button
            type="button"
            className={`toolbar-popover-item ${
              currentBlockType === "quote"
                ? "bg-accent font-semibold text-accent-foreground"
                : ""
            }`}
            onClick={() => handleSelect("quote")}
          >
            <Quote className="h-3.5 w-3.5 opacity-70" />
            <span>Quote</span>
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface EditorToolbarProps {
  editorRef: React.RefObject<MDXEditorMethods | null>;
  markdown: string;
  onH1Attempted: () => void;
}

export default function EditorToolbar({
  editorRef,
  markdown,
  onH1Attempted,
}: EditorToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [showWordCount, setShowWordCount] = useState(true);
  const cleanText = markdown
    // Remove HTML images completely
    .replace(/<img\b[^>]*>/gi, "")
    // Remove Markdown images completely
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    // Decode the spaces/tabs your editor produces
    .replace(/&#x20;/g, " ")
    .replace(/&#x9;/g, "\t");
  // Treat Windows newlines as one character
  const wordCountText = cleanText
    // Newlines separate words, but are not themselves words
    .replace(/\r\n/g, " ")
    .replace(/\n/g, " ")
    .replace(/\r/g, " ");

  const wordCount = wordCountText.trim()
    ? wordCountText.trim().split(/\s+/).length
    : 0;
  const MAX_WORD_COUNT = 2500;
  const previousWordCountRef = useRef(wordCount);

  useEffect(() => {
    if (
      previousWordCountRef.current <= MAX_WORD_COUNT &&
      wordCount > MAX_WORD_COUNT
    ) {
      toast.warning("Word count limit exceeded", {
        description: `Your guide has ${wordCount.toLocaleString()} words. The maximum allowed is ${MAX_WORD_COUNT.toLocaleString()}.`,
      });
    }

    previousWordCountRef.current = wordCount;
  }, [wordCount]);
  const characterCount = cleanText.length;

  // Refs for hidden native buttons to trigger programmatically from our custom Popovers
  const linkRef = useRef<HTMLSpanElement>(null);
  const tableRef = useRef<HTMLSpanElement>(null);
  const thematicBreakRef = useRef<HTMLSpanElement>(null);
  const codeBlockRef = useRef<HTMLSpanElement>(null);
  const inlineMathRef = useRef<HTMLSpanElement>(null);
  const blockMathRef = useRef<HTMLSpanElement>(null);
  const insertDirective = usePublisher(insertDirective$);

  const [isFullScreen, setIsFullScreen] = useState(false);
  const toggleFullScreen = () => {
    document.body.classList.toggle("editor-fullscreen");
    setIsFullScreen(document.body.classList.contains("editor-fullscreen"));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        document.body.classList.contains("editor-fullscreen")
      ) {
        document.body.classList.remove("editor-fullscreen");
        setIsFullScreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.classList.remove("editor-fullscreen");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

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
    <div className="editor-toolbar-wrapper">
      <TooltipProvider>
        <div className="mdxeditor-toolbar-custom">
          <MarkdownLinkImageShortcutListener />
          <H1RestrictionListener onH1Attempted={onH1Attempted} />
          <CodeBlockShortcutListener />
          <CalloutShortcutListener />
          <TabShortcutListener />
          <UndoRedo />
          <div className="mdx-toolbar-divider" />
          <BoldItalicUnderlineToggles />
          <StrikeThroughSupSubToggles options={["Strikethrough"]} />
          <CodeToggle />
          <div className="mdx-toolbar-divider" />
          <CustomBlockTypeSelect />
          <div className="mdx-toolbar-divider" />
          <ListsToggle />
          <IndentButtons />

          <div className="mdx-toolbar-divider" />

          {/* Math Dropdown using Popover */}
          <Popover>
            <Tooltip>
              <PopoverTrigger asChild>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="toolbar-dropdown-trigger shrink-0"
                  >
                    <span className="font-serif font-bold italic">f(x)</span>
                    <span>Math</span>
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </button>
                </TooltipTrigger>
              </PopoverTrigger>

              <TooltipContent>Insert LaTeX Math Equation</TooltipContent>
            </Tooltip>

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
                  setTimeout(() => {
                    inlineMathRef.current?.querySelector("button")?.click();
                  }, 10);
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
                  setTimeout(() => {
                    blockMathRef.current?.querySelector("button")?.click();
                  }, 10);
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
            <Tooltip>
              <PopoverTrigger asChild>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="toolbar-dropdown-trigger shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Insert</span>
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </button>
                </TooltipTrigger>
              </PopoverTrigger>

              <TooltipContent>Insert LaTeX Math Equation</TooltipContent>
            </Tooltip>

            <PopoverContent
              className="toolbar-popover-content"
              align="start"
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <div className="toolbar-popover-header">Elements</div>
              <button
                type="button"
                className="toolbar-popover-item"
                onClick={() => {
                  editorRef.current?.focus();
                  setTimeout(() => {
                    tableRef.current?.querySelector("button")?.click();
                  }, 10);
                }}
              >
                <Table className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Table</span>
              </button>
              <button
                type="button"
                className="toolbar-popover-item"
                onClick={() => {
                  editorRef.current?.focus();
                  setTimeout(() => {
                    codeBlockRef.current?.querySelector("button")?.click();
                  }, 10);
                }}
              >
                <Code className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Code Block</span>
              </button>
              <button
                type="button"
                className="toolbar-popover-item"
                onClick={() => {
                  editorRef.current?.focus();
                  setTimeout(() => {
                    linkRef.current?.querySelector("button")?.click();
                  }, 10);
                }}
              >
                <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Link</span>
              </button>
              <div className="my-1 h-px bg-border" />
              <button
                type="button"
                className="toolbar-popover-item"
                onClick={() => {
                  editorRef.current?.focus();
                  setTimeout(() => {
                    thematicBreakRef.current?.querySelector("button")?.click();
                  }, 10);
                }}
              >
                <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Horizontal Line</span>
              </button>
              <div className="my-1 h-px bg-border" />
              <div className="toolbar-popover-header">Callouts</div>
              <button
                type="button"
                className="toolbar-popover-item"
                onClick={() =>
                  insertDirective({ type: "containerDirective", name: "info" })
                }
              >
                <Info className="h-3.5 w-3.5 text-blue-500" />
                <span>Info Callout</span>
              </button>
              <button
                type="button"
                className="toolbar-popover-item"
                onClick={() =>
                  insertDirective({ type: "containerDirective", name: "note" })
                }
              >
                <Info className="h-3.5 w-3.5 text-blue-500" />
                <span>Note Callout</span>
              </button>
              <button
                type="button"
                className="toolbar-popover-item"
                onClick={() =>
                  insertDirective({ type: "containerDirective", name: "tip" })
                }
              >
                <Lightbulb className="h-3.5 w-3.5 text-green-500" />
                <span>Tip Callout</span>
              </button>
              <button
                type="button"
                className="toolbar-popover-item"
                onClick={() =>
                  insertDirective({
                    type: "containerDirective",
                    name: "caution",
                  })
                }
              >
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <span>Caution Callout</span>
              </button>
              <button
                type="button"
                className="toolbar-popover-item"
                onClick={() =>
                  insertDirective({
                    type: "containerDirective",
                    name: "warning",
                  })
                }
              >
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <span>Warning Callout</span>
              </button>
              <button
                type="button"
                className="toolbar-popover-item"
                onClick={() =>
                  insertDirective({
                    type: "containerDirective",
                    name: "danger",
                  })
                }
              >
                <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                <span>Danger Callout</span>
              </button>
            </PopoverContent>
          </Popover>

          <div className="mdx-toolbar-divider" />

          {/* Desktop Actions & Sharing Button Group */}
          <div className="ml-auto hidden shrink-0 items-center gap-1 p-0.5 sm:flex">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label="Copy Markdown to Clipboard"
                >
                  {copied ? <Check className="text-green-500" /> : <Copy />}
                </button>
              </TooltipTrigger>

              <TooltipContent>Copy Markdown to Clipboard</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleDownload}
                  aria-label="Download as .md file"
                >
                  <Download />
                </button>
              </TooltipTrigger>

              <TooltipContent>Download as .md file</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleImportClick}
                  title="Import .md file"
                  aria-label="Import .md file"
                >
                  <Upload />
                </button>
              </TooltipTrigger>

              <TooltipContent>Import .md file</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setShowWordCount((visible) => !visible)}
                  aria-label={
                    showWordCount ? "Hide Word Count" : "Show Word Count"
                  }
                >
                  {showWordCount ? <Eye /> : <EyeOff />}
                </button>
              </TooltipTrigger>

              <TooltipContent>
                {showWordCount ? "Hide Word Count" : "Show Word Count"}
              </TooltipContent>
            </Tooltip>

            <div className="mx-1 h-4 w-px bg-border" />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={toggleFullScreen}
                  aria-label="Toggle Full Screen"
                >
                  {isFullScreen ? <Minimize /> : <Maximize />}
                </button>
              </TooltipTrigger>

              <TooltipContent>
                {isFullScreen ? "Exit Full Screen" : "Full Screen"}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Mobile More Actions Menu */}
          <div className="ml-auto flex shrink-0 items-center sm:hidden">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="toolbar-dropdown-trigger shrink-0"
                  title="More Actions"
                  aria-label="More Actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="toolbar-popover-content w-48"
                align="end"
                onCloseAutoFocus={(e) => e.preventDefault()}
              >
                <div className="toolbar-popover-header">Actions</div>
                <button
                  type="button"
                  className="toolbar-popover-item"
                  onClick={() => setShowWordCount((visible) => !visible)}
                >
                  {showWordCount ? (
                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                  )}

                  <span>
                    {showWordCount ? "Hide word count" : "Show word count"}
                  </span>
                </button>
                <button
                  type="button"
                  className="toolbar-popover-item"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span>{copied ? "Copied!" : "Copy Markdown"}</span>
                </button>
                <button
                  type="button"
                  className="toolbar-popover-item"
                  onClick={handleDownload}
                >
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Download .md</span>
                </button>
                <button
                  type="button"
                  className="toolbar-popover-item"
                  onClick={handleImportClick}
                >
                  <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Import .md</span>
                </button>

                <div className="my-1 h-px bg-border" />
                <button
                  type="button"
                  className="toolbar-popover-item"
                  onClick={toggleFullScreen}
                >
                  {isFullScreen ? (
                    <Minimize className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <Maximize className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span>{isFullScreen ? "Exit Fullscreen" : "Fullscreen"}</span>
                </button>
              </PopoverContent>
            </Popover>
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
      </TooltipProvider>

      {showWordCount && (
        <div
          className={`editor-word-count ${
            wordCount > MAX_WORD_COUNT ? "text-red-500" : ""
          }`}
        >
          {wordCount.toLocaleString()} words
          <span className="mx-2">·</span>
          {characterCount.toLocaleString()} characters
        </div>
      )}
    </div>
  );
}
