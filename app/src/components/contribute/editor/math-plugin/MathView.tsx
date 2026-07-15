import React, { useEffect, useRef, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import { lexical } from "@mdxeditor/editor";
import katex from "katex";
import { $isMathNode } from "./MathNode";
import { MathFieldAdapter } from "./MathFieldAdapter";
import { cn } from "@/lib/utils";
// ------------------------

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

// ------------------------
// ------------------------

const {
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  COMMAND_PRIORITY_LOW,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  KEY_ENTER_COMMAND,
} = lexical;

interface MathViewProps {
  nodeKey: string;
  equation: string;
  inline: boolean;
}

// Helper to determine if an event target is associated with MathLive/CortexJS elements (including scrims, keyboard panels, menus)
const isTargetMathLive = (target: any): boolean => {
  if (!target) return false;

  let path: Array<any> = [];

  // Extract the original native event from Radix CustomEvent detail if available
  const originalEvent =
    target.detail?.originalEvent || (target instanceof Event ? target : null);
  const element =
    originalEvent?.target ||
    target.target ||
    (target instanceof HTMLElement ? target : null);

  if (originalEvent && typeof originalEvent.composedPath === "function") {
    path = originalEvent.composedPath();
  }

  // Fallback to manual DOM traversal crossing shadow boundaries
  if (path.length === 0 && element) {
    let current = element;
    while (current) {
      path.push(current);
      current =
        current.parentElement ||
        (current.getRootNode && typeof current.getRootNode === "function"
          ? current.getRootNode().host
          : null);
    }
  }

  for (const node of path) {
    if (node && (node.nodeType === 1 || node instanceof HTMLElement)) {
      const tagName = (node.tagName || "").toLowerCase();
      const role = (node.getAttribute && node.getAttribute("role")) || "";
      const part = (node.getAttribute && node.getAttribute("part")) || "";

      if (
        tagName === "math-field" ||
        tagName.includes("math") ||
        tagName.includes("cortexjs") ||
        tagName === "menu" ||
        tagName === "li"
      ) {
        return true;
      }
      if (
        node.id &&
        (node.id.includes("cortexjs") || node.id.includes("mathlive"))
      ) {
        return true;
      }
      if (role === "presentation" || role === "menu" || role === "menuitem") {
        return true;
      }
      if (part.includes("menu") || part.includes("scrim")) {
        return true;
      }
      const classes = Array.from(node.classList || []);
      if (
        classes.some(
          (c: any) =>
            c.startsWith("ML__") ||
            c.startsWith("MLK__") ||
            c.includes("mathfield") ||
            c.includes("cortexjs") ||
            c.includes("mathlive") ||
            c.includes("ui-menu")
        )
      ) {
        return true;
      }
    }
  }
  return false;
};

// Helper to render static equation HTML using KaTeX
const renderKatex = (equation: string, inline: boolean) => {
  try {
    return katex.renderToString(equation, {
      displayMode: !inline,
      throwOnError: false,
    });
  } catch (error) {
    console.error("KaTeX error:", error);
    return `<span class="text-destructive font-mono text-xs">${equation}</span>`;
  }
};

// Inner helper component to manage focus and keyboard actions inside the popover
function MathPopoverEditor({
  equation,
  onChange,
  onClose,
}: {
  equation: string;
  onChange: (val: string) => void;
  onClose: () => void;
}) {
  const editorRef = useRef<any>(null);

  useEffect(() => {
    // Focus the math-field input when the editor mounts in the popover
    const timeoutId = setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.focus();
      }
    }, 150);
    return () => clearTimeout(timeoutId);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <div onKeyDown={handleKeyDown} className="w-full">
      <MathFieldAdapter
        ref={editorRef}
        value={equation}
        onChange={onChange}
        readOnly={false}
        style={{
          width: "100%",
          display: "block",
          minWidth: "16rem",
        }}
      />
    </div>
  );
}

export function MathView({ nodeKey, equation, inline }: MathViewProps) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected] = useLexicalNodeSelection(nodeKey);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | HTMLSpanElement>(null);

  // Synchronize popover open state with Lexical node selection
  useEffect(() => {
    setIsOpen(isSelected);
  }, [isSelected]);

  useEffect(() => {
    if (!isSelected && isOpen) {
      console.trace("[DEBUG] Lexical cleared selection internally!");
    }
  }, [isSelected, isOpen]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      console.trace("[DEBUG] Radix Popover requested close!");
    }
    setIsOpen(open);
    setSelected(open);
    if (!open) {
      // Clear Node selection in Lexical to return focus to the text flow
      editor.update(() => {
        const selection = $getSelection();
        if ($isNodeSelection(selection)) {
          selection.clear();
        }
      });
      // Force editor focus back to text cursor
      editor.getRootElement()?.focus();
    }
  };

  const handleDelete = (e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node !== null) {
        node.remove();
      }
    });
  };

  // Listen for delete/backspace/enter commands when the node is selected in Lexical
  useEffect(() => {
    const handleDeleteCommand = (event: KeyboardEvent) => {
      if (isSelected && $isNodeSelection($getSelection())) {
        event.preventDefault();
        handleDelete();
        return true;
      }
      return false;
    };

    const handleEnterCommand = (event: KeyboardEvent) => {
      if (isSelected && $isNodeSelection($getSelection()) && !isOpen) {
        event.preventDefault();
        setIsOpen(true);
        return true;
      }
      return false;
    };

    const unregisterDelete = editor.registerCommand(
      KEY_DELETE_COMMAND,
      handleDeleteCommand,
      COMMAND_PRIORITY_LOW
    );
    const unregisterBackspace = editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      handleDeleteCommand,
      COMMAND_PRIORITY_LOW
    );
    const unregisterEnter = editor.registerCommand(
      KEY_ENTER_COMMAND,
      handleEnterCommand,
      COMMAND_PRIORITY_LOW
    );

    return () => {
      unregisterDelete();
      unregisterBackspace();
      unregisterEnter();
    };
  }, [editor, nodeKey, isSelected, isOpen]);

  const handleInputChange = (newValue: string) => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isMathNode(node)) {
        node.setEquation(newValue);
      } else {
        console.warn("[Diagnostic] MathNode not found for key:", nodeKey);
      }
    });
  };

  // Render inline math block
  if (inline) {
    return (
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <span
            ref={containerRef}
            onDragStart={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              setSelected(true);
            }}
            className={cn(
              "group math-node relative inline-flex cursor-pointer items-center rounded-md border transition-all duration-200 ease-in-out select-none",
              equation === "" ? "px-1.5 py-0.5" : "px-1.5 py-0",
              isSelected
                ? "border-transparent bg-primary/10 ring-2 ring-primary/50 dark:bg-primary/20"
                : equation === ""
                  ? "border-dashed border-border bg-muted/30 hover:border-muted-foreground/40 hover:bg-muted/50"
                  : "border-transparent bg-transparent hover:border-border hover:bg-muted/40"
            )}
            style={{
              verticalAlign: "middle",
            }}
          >
            {equation === "" ? (
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
              <span
                dangerouslySetInnerHTML={{
                  __html: renderKatex(equation, true),
                }}
                className="math-preview"
              />
            )}
          </span>
        </PopoverTrigger>

        <PopoverContent
          className="z-50 flex w-80 flex-col gap-2.5 rounded-lg bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10"
          align="start"
          sideOffset={8}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => {
            if (isTargetMathLive(e)) {
              e.preventDefault();
            }
          }}
          onFocusOutside={(e) => {
            const originalEvent = e.detail.originalEvent;
            if (isTargetMathLive(e) || originalEvent.target === document.body) {
              e.preventDefault();
            }
          }}
        >
          <div className="flex items-center justify-between border-b border-border pb-1.5">
            <span className="text-xs font-semibold tracking-tight text-foreground">
              Edit Inline Equation
            </span>
            <Button
              type="button"
              variant="destructive"
              size="xs"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </div>
          <div className="flex w-full items-center rounded-md border border-input bg-input/20 px-2 py-1.5 text-sm shadow-xs transition-colors focus-within:border-ring focus-within:bg-background focus-within:ring-2 focus-within:ring-ring/30 dark:bg-input/30">
            <MathPopoverEditor
              equation={equation}
              onChange={handleInputChange}
              onClose={() => handleOpenChange(false)}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="font-medium tracking-wide">
              Press Enter to save
            </span>
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={() => handleOpenChange(false)}
            >
              Done
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Render block math block
  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <div
          ref={containerRef as React.RefObject<HTMLDivElement>}
          onDragStart={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            setSelected(true);
          }}
          className={cn(
            "math-node relative mx-auto my-3 block w-fit max-w-full cursor-pointer rounded-lg text-center transition-all duration-200 ease-in-out select-none",
            isSelected
              ? "bg-primary/5 px-10 py-5 ring-2 ring-primary/40 dark:bg-primary/10"
              : equation === ""
                ? "border border-dashed border-border bg-muted/40 px-8 py-3.5 hover:border-muted-foreground/30 hover:bg-muted/80"
                : "bg-transparent px-6 py-3 ring-0 hover:bg-muted/30 hover:ring-1 hover:ring-border"
          )}
        >
          {equation === "" ? (
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
          ) : (
            <div
              dangerouslySetInnerHTML={{ __html: renderKatex(equation, false) }}
              className="math-preview mx-auto"
            />
          )}
        </div>
      </PopoverTrigger>

      <PopoverContent
        className="z-50 flex w-96 flex-col gap-2.5 rounded-lg bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10"
        align="center"
        sideOffset={8}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => {
          if (isTargetMathLive(e)) {
            e.preventDefault();
          }
        }}
        onFocusOutside={(e) => {
          const originalEvent = e.detail.originalEvent;
          if (isTargetMathLive(e) || originalEvent.target === document.body) {
            e.preventDefault();
          }
        }}
      >
        <div className="flex items-center justify-between border-b border-border pb-1.5">
          <span className="text-xs font-semibold tracking-tight text-foreground">
            Edit Block Equation
          </span>
          <Button
            type="button"
            variant="destructive"
            size="xs"
            onClick={handleDelete}
          >
            Delete
          </Button>
        </div>
        <div className="flex w-full items-center rounded-md border border-input bg-input/20 px-2 py-1.5 text-sm shadow-xs transition-colors focus-within:border-ring focus-within:bg-background focus-within:ring-2 focus-within:ring-ring/30 dark:bg-input/30">
          <MathPopoverEditor
            equation={equation}
            onChange={handleInputChange}
            onClose={() => handleOpenChange(false)}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="font-medium tracking-wide">Press Enter to save</span>
          <Button
            type="button"
            variant="secondary"
            size="xs"
            onClick={() => handleOpenChange(false)}
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
