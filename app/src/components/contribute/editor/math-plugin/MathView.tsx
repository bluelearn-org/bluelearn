import React, { useEffect, useRef, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import { lexical } from "@mdxeditor/editor";
import { $isMathNode } from "./MathNode";
import { MathFieldAdapter } from "./MathFieldAdapter";
import type { MathFieldAdapterRef } from "./MathFieldAdapter";
import { cn } from "@/lib/utils";

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

const isTargetMathLive = (target: Event | EventTarget | null): boolean => {
  if (!target) return false;

  let path: Array<any> = [];
  if ("composedPath" in target && typeof target.composedPath === "function") {
    path = target.composedPath();
  } else {
    let current: any = target;
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
    if (node instanceof HTMLElement) {
      const tagName = node.tagName.toLowerCase();
      if (
        tagName === "math-field" ||
        tagName.includes("math") ||
        tagName.includes("cortexjs")
      ) {
        return true;
      }
      if (
        node.id &&
        (node.id.includes("cortexjs") || node.id.includes("mathlive"))
      ) {
        return true;
      }
      const classes = Array.from(node.classList);
      if (
        classes.some(
          (c) =>
            c.startsWith("ML__") ||
            c.startsWith("MLK__") ||
            c.includes("mathfield") ||
            c.includes("cortexjs") ||
            c.includes("mathlive")
        )
      ) {
        return true;
      }
    }
  }
  return false;
};

export function MathView({ nodeKey, equation, inline }: MathViewProps) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected] = useLexicalNodeSelection(nodeKey);
  const [isFocused, setIsFocused] = useState(false);

  const ref = useRef<MathFieldAdapterRef>(null);
  const containerRef = useRef<HTMLDivElement | HTMLSpanElement>(null);

  const handleFocus = () => {
    setIsFocused(true);
    setSelected(true);
  };

  const handleBlur = (e: React.FocusEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (
      isTargetMathLive(relatedTarget) ||
      isTargetMathLive(document.activeElement)
    ) {
      return;
    }
    setIsFocused(false);
  };

  const handlePointerDown = () => {
    if (editor.isEditable()) {
      setIsFocused(true);
      setSelected(true);
    }
  };

  // Helper to block events from bubbling to Lexical on placeholder interactions
  const handlePlaceholderEvent = (e: React.SyntheticEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.tagName.toLowerCase() !== "math-field" &&
      !target.closest("button")
    ) {
      e.preventDefault();
      e.stopPropagation();
      return true;
    }
    return false;
  };

  // Handle click/pointer outside to blur
  useEffect(() => {
    if (!isFocused) return;

    const handleDocumentPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;

      if (containerRef.current?.contains(target)) {
        return;
      }

      if (isTargetMathLive(e)) {
        return;
      }

      setIsFocused(false);
      if (ref.current) {
        ref.current.blur();
      }
    };

    document.addEventListener("pointerdown", handleDocumentPointerDown);
    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
    };
  }, [isFocused]);

  // Intercept all keyboard events at the native DOM level to prevent Lexical/MDXEditor from consuming them
  useEffect(() => {
    if (!isFocused) return;

    const container = containerRef.current;
    if (!container) return;

    const handleKeyEvents = (evt: Event) => {
      const e = evt as KeyboardEvent;
      // Escape and Enter are handled specifically to exit/navigate the node
      if (e.type === "keydown") {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          if (ref.current) {
            ref.current.blur();
          }
          editor.getRootElement()?.focus();
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          if (ref.current) {
            ref.current.blur();
          }
          editor.getRootElement()?.focus();
          editor.update(() => {
            const node = $getNodeByKey(nodeKey);
            if (node !== null) {
              node.selectNext();
            }
          });
          return;
        }
      }

      // For all other keys, stop propagation so Lexical doesn't see them
      e.stopPropagation();
    };

    container.addEventListener("keydown", handleKeyEvents);
    container.addEventListener("keypress", handleKeyEvents);
    container.addEventListener("keyup", handleKeyEvents);

    return () => {
      container.removeEventListener("keydown", handleKeyEvents);
      container.removeEventListener("keypress", handleKeyEvents);
      container.removeEventListener("keyup", handleKeyEvents);
    };
  }, [editor, nodeKey, isFocused]);

  // Blur the math field if the node is no longer selected in Lexical
  useEffect(() => {
    if (!isSelected && ref.current) {
      ref.current.blur();
      setIsFocused(false);
    }
  }, [isSelected]);

  // Focus the math field when isFocused becomes true (e.g. after clicking placeholder)
  useEffect(() => {
    if (isFocused && ref.current) {
      const timeoutId = setTimeout(() => {
        if (ref.current) {
          ref.current.focus();
        }
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [isFocused]);

  // Update Lexical Node equation on input changes
  const handleInputChange = (newValue: string) => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isMathNode(node)) {
        node.setEquation(newValue);
      }
    });
  };

  // Intercept Lexical backspace/delete commands when the math-field is actively focused
  useEffect(() => {
    const handleDeleteCommand = (event: KeyboardEvent) => {
      if (isFocused) {
        // Prevent Lexical from deleting the node when user hits Backspace/Delete inside the math-field
        return true;
      }
      if (isSelected && $isNodeSelection($getSelection())) {
        event.preventDefault();
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if (node !== null) {
            node.remove();
          }
        });
        return true;
      }
      return false;
    };

    const handleEnterCommand = (event: KeyboardEvent) => {
      if (!isFocused && isSelected && $isNodeSelection($getSelection())) {
        event.preventDefault();
        if (ref.current) {
          ref.current.focus();
        }
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
  }, [editor, isSelected, nodeKey, isFocused]);

  const handleDelete = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.preventDefault();
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node !== null) {
        node.remove();
      }
    });
  };

  const isNodeSelected = isSelected;

  if (inline) {
    return (
      <span
        ref={containerRef}
        onDragStart={(e) => e.preventDefault()}
        onPointerUp={handlePlaceholderEvent}
        onClick={handlePlaceholderEvent}
        onPointerDown={(e) => {
          if (handlePlaceholderEvent(e)) {
            setIsFocused(true);
            setSelected(true);
          }
        }}
        className={cn(
          "group math-node relative inline-flex items-center rounded-md transition-all duration-200 ease-in-out",
          isNodeSelected || isFocused
            ? "bg-primary/5 px-1.5 py-0.5 ring-2 ring-primary/40 dark:bg-primary/10"
            : equation === ""
              ? "cursor-pointer border border-dashed border-border bg-muted/40 px-1 hover:border-muted-foreground/30 hover:bg-muted/80"
              : "bg-transparent px-0 ring-0 hover:bg-muted/30 hover:ring-1 hover:ring-border"
        )}
        style={{
          verticalAlign: "middle",
        }}
      >
        {equation === "" && !isFocused && (
          <span
            key="placeholder"
            className="pointer-events-none px-0.5 font-mono text-xs font-semibold text-muted-foreground/80 select-none"
          >
            ?
          </span>
        )}
        <MathFieldAdapter
          key="math-field-adapter"
          ref={ref}
          value={equation}
          onChange={handleInputChange}
          readOnly={!editor.isEditable() || !isFocused}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onPointerDown={handlePointerDown}
          style={{
            minWidth: isFocused ? "8rem" : "0px",
            width: equation === "" && !isFocused ? "0px" : "auto",
            height: equation === "" && !isFocused ? "0px" : "auto",
            overflow: "hidden",
            display: "inline-block",
            verticalAlign: "middle",
          }}
        />
        {(isNodeSelected || isFocused) && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={handleDelete}
            className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/60 transition-colors duration-200 hover:bg-destructive/15 hover:text-destructive"
            title="Delete equation"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-2.5 w-2.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </span>
    );
  }

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      onDragStart={(e) => e.preventDefault()}
      onPointerUp={handlePlaceholderEvent}
      onClick={handlePlaceholderEvent}
      onPointerDown={(e) => {
        if (handlePlaceholderEvent(e)) {
          setIsFocused(true);
          setSelected(true);
        }
      }}
      className={cn(
        "math-node relative mx-auto my-3 block w-fit max-w-full rounded-lg text-center transition-all duration-200 ease-in-out",
        isNodeSelected || isFocused
          ? "bg-primary/5 px-10 py-5 ring-2 ring-primary/40 dark:bg-primary/10"
          : equation === ""
            ? "cursor-pointer border border-dashed border-border bg-muted/40 px-8 py-3.5 hover:border-muted-foreground/30 hover:bg-muted/80"
            : "bg-transparent px-6 py-3 ring-0 hover:bg-muted/30 hover:ring-1 hover:ring-border"
      )}
    >
      {equation === "" && !isFocused && (
        <div
          key="placeholder"
          className="flex items-center justify-center gap-2.5 py-1 select-none"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 text-primary/50 transition-colors duration-200"
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
          <span className="font-sans text-xs font-semibold tracking-wider text-muted-foreground/70 uppercase transition-colors duration-200">
            Insert block equation
          </span>
        </div>
      )}
      <MathFieldAdapter
        key="math-field-adapter"
        ref={ref}
        value={equation}
        onChange={handleInputChange}
        readOnly={!editor.isEditable() || !isFocused}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onPointerDown={handlePointerDown}
        style={{
          width: "100%",
          display: "block",
          height: equation === "" && !isFocused ? "0px" : "auto",
          overflow: "hidden",
          minWidth: "6rem",
        }}
      />
      {(isNodeSelected || isFocused) && (
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={handleDelete}
          className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/60 transition-colors duration-200 hover:bg-destructive/15 hover:text-destructive"
          title="Delete equation"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-2.5 w-2.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
