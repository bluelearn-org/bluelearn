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
  insertJsx$,
  lexical,
  realmPlugin,
  useLexicalNodeRemove,
  usePublisher,
} from "@mdxeditor/editor";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  $getNodeByKey,
  $createRangeSelection,
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
  nodeKey?: string;
}

type MathEditorPayload = {
  latex: string;
  inline: boolean;
  onChange: (latex: string) => void;
  onRemove: () => void;
  anchorElement: HTMLElement;
  nodeKey?: string;
};

export const OPEN_MATH_EDITOR_COMMAND = createCommand<MathEditorPayload | null>(
  "OPEN_MATH_EDITOR_COMMAND"
);

export function SingletonMathEditor() {
  const [editor] = useLexicalComposerContext();
  const [payload, setPayload] = useState<MathEditorPayload | null>(null);
  const [position, setPosition] = useState({
    top: -9999,
    left: -9999,
    width: 0,
  });
  const mfRef = useRef<any>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const internalLatexRef = useRef("");

  // Position updater
  const updatePosition = useCallback(() => {
    if (!payload?.anchorElement) return;
    const rect = payload.anchorElement.getBoundingClientRect();
    setPosition({
      top: rect.bottom + window.scrollY + 8,
      left: Math.max(
        16,
        rect.left + window.scrollX - (payload.inline ? 0 : 64)
      ), // Adjust for center alignment
      width: rect.width,
    });
  }, [payload]);

  // Handle command
  useEffect(() => {
    return editor.registerCommand(
      OPEN_MATH_EDITOR_COMMAND,
      (newPayload) => {
        if (newPayload) {
          internalLatexRef.current = newPayload.latex;
          setPayload(newPayload);

          if (mfRef.current) {
            mfRef.current.value = newPayload.latex;
            setTimeout(() => {
              if (mfRef.current) mfRef.current.focus();
            }, 50);
          }
        } else {
          setPayload(null);
        }
        return true;
      },
      COMMAND_PRIORITY_NORMAL
    );
  }, [editor]);

  // Update position on scroll/resize when active
  useEffect(() => {
    if (!payload) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [payload, updatePosition]);

  // Input listener
  useEffect(() => {
    const mf = mfRef.current;
    if (!mf) return;

    const handleInput = (e: Event) => {
      const newVal = (e.target as any).value;
      internalLatexRef.current = newVal;
      if (payload) {
        payload.onChange(newVal);
      }
    };

    mf.addEventListener("input", handleInput);
    return () => mf.removeEventListener("input", handleInput);
  }, [payload]);

  // Outside click to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!payload) return;
      const target = e.target as HTMLElement;

      // Ignore clicks on math-field internals, menus, or scrims
      if (
        target.tagName === "MATH-FIELD" ||
        target.closest("math-field") ||
        target.closest("menu") ||
        target.getAttribute("role") === "presentation" ||
        payload.anchorElement.contains(target)
      ) {
        return;
      }

      if (popoverRef.current && !popoverRef.current.contains(target)) {
        setPayload(null);
      }
    };

    document.addEventListener("pointerdown", handleClickOutside, {
      capture: true,
    });
    return () =>
      document.removeEventListener("pointerdown", handleClickOutside, {
        capture: true,
      });
  }, [payload]);

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
          math-virtual-keyboard-policy="manual"
          className="w-full text-lg outline-none"
          style={{ backgroundColor: "transparent" }}
          onKeyDown={(e: any) => {
            if (e.key === "Enter" || e.key === "Escape") {
              e.preventDefault();
              setPayload(null);
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
            onClick={() => {
              setPayload(null);
            }}
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
  const removeNode = useLexicalNodeRemove();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(
    nodeKey || "unknown"
  );

  useEffect(() => {
    if (containerRef.current && latex !== "") {
      katex.render(latex, containerRef.current, {
        displayMode: !inline,
        throwOnError: false,
      });
    }
  }, [latex, inline]);

  const equation = latex;

  const triggerClasses = inline
    ? cn(
        "group math-node relative inline-flex cursor-pointer items-center rounded-md border px-0 py-0 align-middle transition-all duration-200 ease-in-out select-all",
        equation === ""
          ? "border-dashed border-border bg-muted/30 hover:border-muted-foreground/40 hover:bg-muted/50"
          : "border-transparent bg-transparent hover:border-border hover:bg-muted/40",
        isSelected && "!border-transparent bg-primary/5 ring-2 ring-primary/40"
      )
    : cn(
        "math-node relative mx-auto my-3 block w-fit max-w-full cursor-pointer rounded-lg px-4 py-1.5 text-center transition-all duration-200 ease-in-out select-all",
        equation === ""
          ? "border border-dashed border-border bg-muted/40 hover:border-muted-foreground/30 hover:bg-muted/80"
          : "bg-transparent ring-0 hover:bg-muted/30 hover:ring-1 hover:ring-border",
        isSelected &&
          "scale-[1.02] !border-transparent bg-primary/5 ring-2 ring-primary/40"
      );

  return (
    <span
      contentEditable={false}
      onDragStart={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        if (nodeKey) {
          clearSelection();
          setSelected(true);
        }
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
          <span className="inline-flex items-center justify-center">
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
          <div className="flex items-center justify-center gap-2.5 py-1">
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
              ? "math-preview"
              : "math-preview mx-auto [&>.katex-display]:m-0"
          }
        />
      )}
    </span>
  );
}

// Math Utility Functions
function isValidInlineMathEquation(equation: string): boolean {
  if (equation.length === 0) return false;
  if (equation.includes("\n")) return false;
  if (equation.startsWith(" ") || equation.endsWith(" ")) return false;
  return true;
}

function findMathInText(text: string) {
  let i = 0;
  while (i < text.length) {
    if (text[i] === "$") {
      if (i + 1 < text.length && text[i + 1] === "$") {
        let j = i + 2;
        while (j < text.length) {
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
  const insertJsx = usePublisher(insertJsx$);

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
            if (textBeforeCursor.endsWith("$$")) {
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
            if ($isTextNode(node)) {
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
            }
          });

          setTimeout(() => {
            insertJsx({
              kind: "text",
              name: "Math",
              props: {
                latex: scheduledInsert.equation,
                inline: {
                  type: "expression",
                  value: scheduledInsert.isInline ? "true" : "false",
                },
              },
            });
          }, 0);
        }
      }
    );
  }, [editor, insertJsx]);

  return null;
}

export const mathShortcutsPlugin = realmPlugin({
  init: (realm) => {
    realm.pubIn({
      [addComposerChild$]: () => (
        <>
          <MathShortcutTypeListener />
          <SingletonMathEditor />
        </>
      ),
    });
  },
});

export function InsertInlineMath() {
  const insertJsx = usePublisher(insertJsx$);
  return (
    <button
      type="button"
      onClick={() => {
        insertJsx({
          kind: "text",
          name: "Math",
          props: { latex: "", inline: { type: "expression", value: "true" } },
        });
      }}
      className="flex min-h-7 min-w-7 items-center justify-center gap-1 rounded p-1.5 text-slate-800 transition-colors hover:bg-slate-200"
      title="Insert Inline Math (e.g. $e = mc^2$)"
    >
      <span className="font-serif text-sm font-bold">f(x)</span>
    </button>
  );
}

export function InsertBlockMath() {
  const insertJsx = usePublisher(insertJsx$);
  return (
    <button
      type="button"
      onClick={() => {
        insertJsx({
          kind: "text",
          name: "Math",
          props: { latex: "", inline: { type: "expression", value: "false" } },
        });
      }}
      className="flex min-h-7 min-w-7 items-center justify-center gap-1 rounded p-1.5 text-slate-800 transition-colors hover:bg-slate-200"
      title="Insert Block Math (e.g. $$f(x) = \\sin(x)$$)"
    >
      <span className="font-serif text-sm font-bold italic">$$</span>
    </button>
  );
}
