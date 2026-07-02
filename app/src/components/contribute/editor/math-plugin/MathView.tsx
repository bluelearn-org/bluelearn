import React, { useEffect, useRef, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import { lexical } from "@mdxeditor/editor";
import { $isMathNode } from "./MathNode";

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

/* eslint-disable @typescript-eslint/no-namespace */
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "math-field": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          "virtual-keyboard-mode"?: string;
          value?: string;
          readOnly?: boolean;
          "read-only"?: string;
        },
        HTMLElement
      >;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

export function MathView({ nodeKey, equation, inline }: MathViewProps) {
  const [editor] = useLexicalComposerContext();
  const [isSelected] = useLexicalNodeSelection(nodeKey);
  const [isFocused, setIsFocused] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const ref = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | HTMLSpanElement>(null);

  const handleFocus = () => {
    setIsFocused(true);
  };

  // Load MathLive dynamically on the client (SSR safe)
  useEffect(() => {
    import("mathlive").then((mathlive) => {
      mathlive.MathfieldElement.fontsDirectory =
        "https://unpkg.com/mathlive@0.110.0/dist/fonts";
      setIsLoaded(true);
    });
  }, []);

  // Sync equation prop to math-field value when it changes externally or after MathLive loads
  useEffect(() => {
    if (isLoaded && ref.current) {
      if (ref.current.value !== equation) {
        ref.current.value = equation;
      }
    }
  }, [equation, isLoaded]);

  // Auto-focus empty equations when they are selected (e.g. immediately after insertion)
  useEffect(() => {
    if (isLoaded && isSelected && equation === "" && ref.current) {
      ref.current.focus();
    }
  }, [isLoaded, isSelected, equation]);

  // Update Lexical Node equation on input changes
  useEffect(() => {
    const mf = ref.current;
    if (!mf) {
      return;
    }

    const handleInput = (e: Event) => {
      const newValue = (e.target as any).value;
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isMathNode(node)) {
          node.setEquation(newValue);
        }
      });
    };

    mf.addEventListener("input", handleInput);
    return () => {
      mf.removeEventListener("input", handleInput);
    };
  }, [editor, nodeKey]);

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

  const handleKeyDown = (e: any) => {
    if (e.key === "Escape") {
      e.currentTarget.blur();
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (node !== null) {
          node.selectNext();
        }
      });
    }
  };

  const isNodeSelected = isSelected;

  if (inline) {
    return (
      <span
        ref={containerRef}
        onDragStart={(e) => e.preventDefault()}
        className={`group math-node relative inline-flex items-center rounded transition-all duration-200 ${
          isNodeSelected || isFocused
            ? "px-1 ring-2 ring-sky-500/50"
            : "bg-transparent px-0 ring-0 hover:bg-slate-100/50 hover:ring-1 hover:ring-slate-300/50"
        }`}
        style={{
          verticalAlign: "middle",
        }}
      >
        <math-field
          ref={ref}
          value={equation}
          virtual-keyboard-mode="manual"
          onFocus={handleFocus}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          style={{
            minWidth: isFocused ? "8rem" : "0px",
            display: "inline-block",
            verticalAlign: "middle",
          }}
        />
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
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
        className={`math-node block rounded-lg border-none px-6 py-3 text-center transition-all duration-200 ${
          isNodeSelected || isFocused
            ? "ring-2 ring-sky-500/50"
            : "bg-transparent ring-0 group-hover:bg-slate-50/50 group-hover:ring-1 group-hover:ring-slate-300/50"
        }`}
      >
        <math-field
          ref={ref}
          value={equation}
          virtual-keyboard-mode="manual"
          onFocus={handleFocus}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          style={{
            width: "100%",
            display: "block",
            minWidth: "6rem",
          }}
        />
      </div>
      <button
        type="button"
        onMouseDown={(e) => e.stopPropagation()}
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
