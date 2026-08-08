import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "katex/dist/katex.min.css";
import katex from "katex";
import "mathlive";
import { Trash2 } from "lucide-react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import {
  addComposerChild$,
  addExportVisitor$,
  addImportVisitor$,
  addLexicalNode$,
  addMdastExtension$,
  addNestedEditorChild$,
  addSyntaxExtension$,
  addTableCellEditorChild$,
  addToMarkdownExtension$,
  insertDecoratorNode$,
  lexical,
  realmPlugin,
  usePublisher,
} from "@mdxeditor/editor";
import { math } from "micromark-extension-math";
import { mathFromMarkdown, mathToMarkdown } from "mdast-util-math";
import { MathExportVisitor, MathImportVisitor } from "./MathVisitors";
import { $createMathNode, MathNode } from "./MathNode";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

if (typeof window !== "undefined") {
  // @ts-ignore: MathfieldElement is added to window by mathlive, but not typed natively
  window.MathfieldElement.fontsDirectory = "/mathlive/fonts";
}

const {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  $getNodeByKey,
  $createNodeSelection,
  $createRangeSelection,
  $insertNodes,
  $setSelection,
  createCommand,
  COMMAND_PRIORITY_NORMAL,
} = lexical;

/* eslint-disable @typescript-eslint/no-namespace */
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "math-field": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          value?: string;
          "math-virtual-keyboard-policy"?: string;
        },
        HTMLElement
      >;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

export interface MathLiveComponentProps {
  latex: string;
  inline: boolean;
  onChange: (latex: string) => void;
  nodeKey: string;
}

type MathEditorPayload = {
  latex: string;
  inline: boolean;
  onChange: (latex: string) => void;
  onRemove: () => void;
  anchorElement: HTMLElement;
  nodeKey: string;
};

export const OPEN_MATH_EDITOR_COMMAND = createCommand<MathEditorPayload | null>(
  "OPEN_MATH_EDITOR_COMMAND"
);

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(max-width: 768px), (pointer: coarse)").matches ||
    navigator.maxTouchPoints > 0 ||
    window.innerWidth < 768
  );
}

export function SingletonMathEditor() {
  const [editor] = useLexicalComposerContext();
  const [payload, setPayload] = useState<MathEditorPayload | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [position, setPosition] = useState({
    top: -9999,
    left: -9999,
    width: 0,
  });
  const mfRef = useRef<any>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const pendingLatexRef = useRef<string | null>(null);
  const commitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const payloadRef = useRef<MathEditorPayload | null>(null);
  payloadRef.current = payload;

  useEffect(() => {
    const check = () => setIsMobile(isMobileDevice());
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const cancelPending = useCallback(() => {
    if (commitTimeoutRef.current) {
      clearTimeout(commitTimeoutRef.current);
      commitTimeoutRef.current = null;
    }
    pendingLatexRef.current = null;
  }, []);

  const commitLatex = useCallback(
    (latex: string, onChange: (latex: string) => void) => {
      pendingLatexRef.current = latex;
      if (commitTimeoutRef.current) clearTimeout(commitTimeoutRef.current);
      commitTimeoutRef.current = setTimeout(() => {
        commitTimeoutRef.current = null;
        pendingLatexRef.current = null;
        onChange(latex);
      }, 300);
    },
    []
  );

  const closeEditor = useCallback(() => {
    const current = payloadRef.current;
    if (current && pendingLatexRef.current !== null) {
      current.onChange(pendingLatexRef.current);
    }
    const mvk = (window as any).mathVirtualKeyboard;
    if (mvk && typeof mvk.hide === "function") {
      mvk.hide();
    }
    cancelPending();
    setPayload(null);
  }, [cancelPending]);

  const updatePosition = useCallback(() => {
    const current = payloadRef.current;
    if (!current?.anchorElement) return;
    const rect = current.anchorElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const popoverWidth = Math.min(
      current.inline ? 352 : 480,
      viewportWidth - 32
    );

    let left = rect.left + window.scrollX - (current.inline ? 0 : 64);
    if (left + popoverWidth > window.scrollX + viewportWidth - 16) {
      left = window.scrollX + viewportWidth - popoverWidth - 16;
    }
    left = Math.max(window.scrollX + 16, left);

    let top = rect.bottom + window.scrollY + 8;
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < 200 && rect.top > 160) {
      top = rect.top + window.scrollY - 130;
    }

    setPosition({
      top,
      left,
      width: rect.width,
    });
  }, []);

  // Listen for open commands
  useEffect(() => {
    return editor.registerCommand(
      OPEN_MATH_EDITOR_COMMAND,
      (newPayload) => {
        if (!newPayload) {
          closeEditor();
          return true;
        }
        pendingLatexRef.current = null;
        setPayload(newPayload);
        return true;
      },
      COMMAND_PRIORITY_NORMAL
    );
  }, [editor, closeEditor]);

  useEffect(() => {
    if (!payload) return;
    const mf = mfRef.current;
    if (!mf) return;
    mf.value = payload.latex;
    mf.mathVirtualKeyboardPolicy = isMobile ? "auto" : "manual";
    const frame = requestAnimationFrame(() => {
      mfRef.current?.focus();
      const mvk = (window as any).mathVirtualKeyboard;
      if (isMobile && mvk && typeof mvk.show === "function") {
        mvk.show();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [payload, isMobile]);

  useEffect(() => {
    return () => {
      const current = payloadRef.current;
      if (current && pendingLatexRef.current !== null) {
        current.onChange(pendingLatexRef.current);
      }
      if (commitTimeoutRef.current) clearTimeout(commitTimeoutRef.current);
      const mvk = (window as any).mathVirtualKeyboard;
      if (mvk && typeof mvk.hide === "function") {
        mvk.hide();
      }
    };
  }, []);

  // Update position on scroll/resize when active
  useEffect(() => {
    if (!payload) return;
    updatePosition();

    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        updatePosition();
      });
    };

    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [payload, updatePosition]);

  // Input listener
  useEffect(() => {
    const mf = mfRef.current;
    if (!mf || !payload) return;

    const handleInput = (e: Event) => {
      commitLatex((e.target as any).value, payload.onChange);
    };

    const handleMoveOut = () => {
      const { nodeKey } = payload;
      closeEditor();
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (node) {
          node.selectNext();
        }
      });
    };

    mf.addEventListener("input", handleInput);
    mf.addEventListener("move-out", handleMoveOut);
    return () => {
      mf.removeEventListener("input", handleInput);
      mf.removeEventListener("move-out", handleMoveOut);
    };
  }, [payload, commitLatex, closeEditor, editor]);

  // Outside click to close
  useEffect(() => {
    if (!payload) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;

      // Handle composed path for shadow DOM and virtual keyboard clicks
      const rawPath = "composedPath" in e ? e.composedPath() : [target];
      const isInternalOrKeyboard = rawPath.some((node) => {
        if (!(node instanceof HTMLElement)) return false;
        const tag = node.tagName.toLowerCase();
        const className =
          typeof node.className === "string" ? node.className : "";
        return (
          tag === "math-field" ||
          tag === "math-virtual-keyboard" ||
          tag === "menu" ||
          className.includes("ML__") ||
          className.includes("MLK") ||
          className.includes("virtual-keyboard") ||
          node.hasAttribute("data-ml-virtual-keyboard") ||
          node.getAttribute("role") === "presentation" ||
          payload.anchorElement.contains(node)
        );
      });

      if (isInternalOrKeyboard) {
        return;
      }

      if (popoverRef.current && !popoverRef.current.contains(target)) {
        closeEditor();
      }
    };

    document.addEventListener("pointerdown", handleClickOutside, {
      capture: true,
    });
    return () =>
      document.removeEventListener("pointerdown", handleClickOutside, {
        capture: true,
      });
  }, [payload, closeEditor]);

  const isVisible = !!payload;
  const portalNode = typeof document !== "undefined" ? document.body : null;
  if (!portalNode) return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: "absolute",
        top: isVisible ? position.top : -9999,
        left: isVisible ? position.left : -9999,
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? "auto" : "none",
        transition: "opacity 0.15s ease",
      }}
      className={cn(
        "z-[9999] flex flex-col gap-2 rounded-xl bg-popover p-2 text-popover-foreground shadow-lg ring-1 ring-border",
        payload?.inline ? "w-[22rem] max-w-[90vw]" : "w-[30rem] max-w-[90vw]"
      )}
    >
      <div className="flex w-full items-center rounded-md border border-input bg-background px-2 py-2 text-sm shadow-sm transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
        <math-field
          ref={mfRef}
          math-virtual-keyboard-policy={isMobile ? "auto" : "manual"}
          className="w-full text-lg text-foreground outline-none"
          style={{ backgroundColor: "transparent", color: "var(--foreground)" }}
          onKeyDown={(e: any) => {
            if (e.key === "Enter" || e.key === "Escape") {
              e.preventDefault();
              closeEditor();
              editor.focus();
            }
          }}
        />
      </div>

      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              if (payload) {
                cancelPending();
                payload.onRemove();
                setPayload(null);
              }
            }}
            title="Delete Equation"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground/70">
            <kbd className="pointer-events-none inline-flex h-4 items-center gap-1 rounded border border-border bg-muted/50 px-1 font-mono text-[9px] font-medium text-muted-foreground">
              <span className="text-[10px]">↵</span> Enter
            </kbd>
            to save
          </span>
          <Button
            type="button"
            variant="default"
            size="sm"
            className="h-7 rounded-md px-3 text-xs"
            onClick={closeEditor}
          >
            Done
          </Button>
        </div>
      </div>
    </div>,
    portalNode
  );
}

export function MathLiveComponent({
  latex = "",
  inline = false,
  onChange,
  nodeKey,
}: MathLiveComponentProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] =
    useLexicalNodeSelection(nodeKey);
  const [isRangeSelected, setIsRangeSelected] = useState(false);

  const removeNode = useCallback(() => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node) {
        node.remove();
      }
    });
  }, [editor, nodeKey]);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const nodes = selection.getNodes();
          setIsRangeSelected(nodes.some((n) => n.getKey() === nodeKey));
        } else {
          setIsRangeSelected(false);
        }
      });
    });
  }, [editor, nodeKey]);

  useEffect(() => {
    if (containerRef.current && latex !== "") {
      katex.render(latex, containerRef.current, {
        displayMode: !inline,
        throwOnError: false,
      });
    }
  }, [latex, inline]);

  const equation = latex;

  const isNodeSelected = isSelected || isRangeSelected;

  const triggerClasses = inline
    ? cn(
        "group math-node relative inline-flex cursor-pointer items-center rounded-md border px-0 py-0 align-middle transition-all duration-200 ease-in-out",
        equation === ""
          ? "border-dashed border-border bg-muted/30 hover:border-muted-foreground/40 hover:bg-muted/50"
          : "border-transparent bg-transparent hover:border-border hover:bg-muted/40",
        isNodeSelected &&
          "!border-transparent bg-primary/5 ring-2 ring-primary/40"
      )
    : cn(
        "math-node relative mx-auto my-3 block w-fit max-w-full cursor-pointer rounded-lg px-4 py-1.5 text-center transition-all duration-200 ease-in-out select-none",
        equation === ""
          ? "border border-dashed border-border bg-muted/40 hover:border-muted-foreground/30 hover:bg-muted/80"
          : "bg-transparent ring-0 hover:bg-muted/30 hover:ring-1 hover:ring-border",
        isNodeSelected &&
          "scale-[1.02] !border-transparent bg-primary/5 ring-2 ring-primary/40"
      );

  return (
    <span
      contentEditable={false}
      onDragStart={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        clearSelection();
        setSelected(true);
        editor.dispatchCommand(OPEN_MATH_EDITOR_COMMAND, {
          latex,
          inline,
          onChange,
          onRemove: removeNode,
          anchorElement: e.currentTarget,
          nodeKey,
        });
      }}
      className={triggerClasses}
    >
      {equation === "" ? (
        inline ? (
          <span className="pointer-events-none inline-flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-primary/50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 7H7l4 5-4 5h10"
              />
            </svg>
          </span>
        ) : (
          <div className="pointer-events-none flex items-center justify-center gap-2.5 py-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-primary/50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 7H7l4 5-4 5h10"
              />
            </svg>
            <span className="font-sans text-xs font-semibold tracking-wider text-muted-foreground/70 uppercase">
              Insert block equation
            </span>
          </div>
        )
      ) : (
        <span
          ref={containerRef}
          className={
            inline
              ? "math-preview pointer-events-none"
              : "math-preview pointer-events-none mx-auto [&>.katex-display]:m-0"
          }
        />
      )}
    </span>
  );
}

function isValidInlineMathEquation(equation: string): boolean {
  if (equation.length === 0) return false;
  if (equation.includes("\n")) return false;
  if (equation.startsWith(" ") || equation.endsWith(" ")) return false;
  return true;
}

function findMathInText(text: string) {
  let i = 0;
  while (i < text.length) {
    if (text[i] === "\\" && i + 1 < text.length && text[i + 1] === "$") {
      i += 2;
      continue;
    }

    if (text[i] === "$") {
      if (i + 1 < text.length && text[i + 1] === "$") {
        let j = i + 2;
        while (j < text.length) {
          if (text[j] === "\\" && j + 1 < text.length && text[j + 1] === "$") {
            j += 2;
            continue;
          }
          if (text[j] === "$" && j + 1 < text.length && text[j + 1] === "$") {
            const equation = text.slice(i + 2, j);
            return { isInline: false, startIdx: i, endIdx: j + 1, equation };
          }
          j++;
        }
        i += 2;
        continue;
      } else {
        let j = i + 1;
        while (j < text.length) {
          if (text[j] === "\\" && j + 1 < text.length && text[j + 1] === "$") {
            j += 2;
            continue;
          }
          if (text[j] === "$") {
            if (j + 1 < text.length && text[j + 1] === "$") break;
            const rawEquation = text.slice(i + 1, j);
            if (isValidInlineMathEquation(rawEquation)) {
              return {
                isInline: true,
                startIdx: i,
                endIdx: j,
                equation: rawEquation.trim(),
              };
            } else {
              break;
            }
          }
          j++;
        }
      }
    }
    i++;
  }
  return null;
}

export function MathShortcutTypeListener() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerUpdateListener(
      ({ tags, dirtyLeaves, editorState }) => {
        if (tags.has("collaboration") || tags.has("historic")) return;
        if (editor.isComposing()) return;

        let scheduledInsert: any = null;

        editorState.read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;

          const anchorKey = selection.anchor.key;
          const anchorOffset = selection.anchor.offset;
          const anchorNode = $getNodeByKey(anchorKey);

          if (!$isTextNode(anchorNode) || !dirtyLeaves.has(anchorKey)) return;

          const parentNode = anchorNode.getParent();
          if (parentNode === null || parentNode.getType() === "code") return;

          const textContent = anchorNode.getTextContent();
          const match = findMathInText(textContent);

          let startIdx: number;
          let endIdx: number;
          let equation: string;
          let isInline: boolean;

          if (match) {
            const isCursorInMatch =
              anchorOffset >= match.startIdx &&
              anchorOffset <= match.endIdx + 1;
            if (!isCursorInMatch) return;
            startIdx = match.startIdx;
            endIdx = match.endIdx;
            equation = match.equation;
            isInline = match.isInline;
          } else {
            const textBeforeCursor = textContent.slice(0, anchorOffset);
            if (
              textBeforeCursor.endsWith("$$") &&
              !textBeforeCursor.endsWith("\\$$")
            ) {
              startIdx = anchorOffset - 2;
              endIdx = anchorOffset - 1;
              equation = "";
              isInline = false;
            } else {
              return;
            }
          }

          scheduledInsert = { startIdx, endIdx, equation, isInline, anchorKey };
        });

        if (scheduledInsert) {
          editor.update(() => {
            const node = $getNodeByKey(scheduledInsert.anchorKey);
            if (!$isTextNode(node)) return;

            const rangeSelection = $createRangeSelection();
            rangeSelection.anchor.set(
              node.getKey(),
              scheduledInsert.startIdx,
              "text"
            );
            rangeSelection.focus.set(
              node.getKey(),
              scheduledInsert.endIdx + 1,
              "text"
            );
            $setSelection(rangeSelection);

            const mathNode = $createMathNode(
              scheduledInsert.equation,
              scheduledInsert.isInline
            );
            $insertNodes([mathNode]);

            const nodeSelection = $createNodeSelection();
            nodeSelection.add(mathNode.getKey());
            $setSelection(nodeSelection);
          });
        }
      }
    );
  }, [editor]);

  return null;
}

export const mathPlugin = realmPlugin({
  init: (realm) => {
    realm.pubIn({
      [addSyntaxExtension$]: math(),
      [addMdastExtension$]: mathFromMarkdown(),
      [addToMarkdownExtension$]: mathToMarkdown(),
      [addLexicalNode$]: MathNode,
      [addImportVisitor$]: MathImportVisitor,
      [addExportVisitor$]: MathExportVisitor,
      [addComposerChild$]: () => (
        <>
          <MathShortcutTypeListener />
          <SingletonMathEditor />
        </>
      ),
      [addNestedEditorChild$]: () => <MathShortcutTypeListener />,
      [addTableCellEditorChild$]: () => <MathShortcutTypeListener />,
    });
  },
});

export function InsertInlineMath() {
  const insertDecoratorNode = usePublisher(insertDecoratorNode$);
  return (
    <button
      type="button"
      onClick={() => {
        insertDecoratorNode(() => $createMathNode("", true));
      }}
      className="flex min-h-7 min-w-7 items-center justify-center gap-1 rounded p-1.5 text-foreground transition-colors hover:bg-muted"
      title="Insert Inline Math (e.g. $e = mc^2$)"
    >
      <span className="font-serif text-sm font-bold">f(x)</span>
    </button>
  );
}

export function InsertBlockMath() {
  const insertDecoratorNode = usePublisher(insertDecoratorNode$);
  return (
    <button
      type="button"
      onClick={() => {
        insertDecoratorNode(() => $createMathNode("", false));
      }}
      className="flex min-h-7 min-w-7 items-center justify-center gap-1 rounded p-1.5 text-foreground transition-colors hover:bg-muted"
      title="Insert Block Math (e.g. $$f(x) = \\sin(x)$$)"
    >
      <span className="font-serif text-sm font-bold italic">$$</span>
    </button>
  );
}
