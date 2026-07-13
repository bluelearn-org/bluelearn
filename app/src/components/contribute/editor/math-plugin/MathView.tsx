import React, { useEffect, useRef, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import { lexical } from "@mdxeditor/editor";
import { $isMathNode } from "./MathNode";
import { MathFieldAdapter } from "./MathFieldAdapter";
import type { MathFieldAdapterRef } from "./MathFieldAdapter";

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

const isTargetMathLive = (el: HTMLElement | null): boolean => {
  if (!el) return false;

  let current: HTMLElement | null = el;
  while (current && current !== document.body) {
    const classes = Array.from(current.classList);
    if (
      classes.some(
        (c) =>
          c.startsWith("ML__") ||
          c.startsWith("MLK__") ||
          c.includes("mathfield") ||
          c.includes("cortexjs")
      ) ||
      current.id.includes("cortexjs") ||
      current.tagName.toLowerCase() === "math-field"
    ) {
      return true;
    }
    current = current.parentElement;
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
      isTargetMathLive(document.activeElement as HTMLElement)
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

      if (isTargetMathLive(target)) {
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
        className={`group math-node relative inline-flex items-center rounded transition-all duration-200 ${
          isNodeSelected || isFocused
            ? "px-1 ring-2 ring-sky-500/50"
            : equation === ""
              ? "cursor-pointer border border-dashed border-slate-300 bg-slate-100/80 px-1 hover:bg-slate-200/80"
              : "bg-transparent px-0 ring-0 hover:bg-slate-100/50 hover:ring-1 hover:ring-slate-300/50"
        }`}
        style={{
          verticalAlign: "middle",
        }}
      >
        {equation === "" && !isFocused && (
          <span className="pointer-events-none px-0.5 font-mono text-xs font-semibold text-slate-400 select-none">
            ?
          </span>
        )}
        <MathFieldAdapter
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
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={handleDelete}
          className="absolute -top-4 -right-2.5 z-20 flex scale-90 items-center justify-center rounded-full border border-slate-200 bg-white p-1 text-slate-400 opacity-0 shadow-md transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
          title="Delete equation"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </span>
    );
  }

  return (
    <div className="group relative mx-auto my-3 w-fit max-w-full">
      <div className="pointer-events-none absolute -top-5 left-0 z-10 rounded bg-slate-200/40 px-2 py-0.5 text-[9px] font-medium tracking-wider text-slate-500 uppercase opacity-0 transition-opacity duration-200 select-none group-hover:opacity-100">
        Equation
      </div>
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
        className={`math-node block rounded-lg text-center transition-all duration-200 ${
          isNodeSelected || isFocused
            ? "px-6 py-3 ring-2 ring-sky-500/50"
            : equation === ""
              ? "cursor-pointer border border-dashed border-slate-300 bg-slate-100/80 px-6 py-2 hover:bg-slate-200/80"
              : "bg-transparent px-6 py-3 ring-0 group-hover:bg-slate-50/50 group-hover:ring-1 group-hover:ring-slate-300/50"
        }`}
      >
        {equation === "" && !isFocused && (
          <div className="pointer-events-none py-1 font-mono text-sm font-semibold text-slate-400 select-none">
            $$ ? $$
          </div>
        )}
        <MathFieldAdapter
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
      </div>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={handleDelete}
        className="absolute -top-3 -right-3 z-20 flex scale-90 items-center justify-center rounded-full border border-slate-200 bg-white p-1 text-slate-400 opacity-0 shadow-md transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
        title="Delete equation"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3 w-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>
    </div>
  );
}
