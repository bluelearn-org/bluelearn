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
import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { MathExportVisitor, MathImportVisitor } from "./MathVisitors";
import { $createMathNode, MathNode } from "./MathNode";

const {
  $createNodeSelection,
  $createRangeSelection,
  $getNodeByKey,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
} = lexical;

// --- Helper Functions ---

/**
 * Validates whether the matched inline equation string conforms to inline math syntax.
 * Rules:
 * - Cannot be empty
 * - Cannot contain newline characters
 * - Cannot start or end with a space
 */
function isValidInlineMathEquation(equation: string): boolean {
  if (equation.length === 0) {
    return false;
  }
  if (equation.includes("\n")) {
    return false;
  }
  if (equation.startsWith(" ") || equation.endsWith(" ")) {
    return false;
  }
  return true;
}

/**
 * Finds the start and end indices of a math equation (inline or block) in the text.
 */
function findMathInText(text: string): {
  isInline: boolean;
  startIdx: number;
  endIdx: number;
  equation: string;
} | null {
  let i = 0;
  while (i < text.length) {
    if (text[i] === "$") {
      // Check if it's block math ($$)
      if (i + 1 < text.length && text[i + 1] === "$") {
        // Find closing $$
        let j = i + 2;
        while (j < text.length) {
          if (text[j] === "$" && j + 1 < text.length && text[j + 1] === "$") {
            const equation = text.slice(i + 2, j);
            return {
              isInline: false,
              startIdx: i,
              endIdx: j + 1,
              equation,
            };
          }
          j++;
        }
        // Increment by 2 to skip block start delimiter
        i += 2;
        continue;
      } else {
        // Potential inline math ($)
        // Find closing $
        let j = i + 1;
        while (j < text.length) {
          if (text[j] === "$") {
            if (j + 1 < text.length && text[j + 1] === "$") {
              // Hit double $, which means inline math is invalid or it's start of block math
              break;
            }
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

// --- Plugins & Components ---

/**
 * A Lexical plugin that listens for the '$' character typed by the user to automatically trigger
 * inline ($equation$) or block ($$equation$$) math formatting replacements.
 */
export function MathShortcutTypeListener() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerUpdateListener(
      ({ tags, dirtyLeaves, editorState }) => {
        // Ignore updates from collaboration and undo/redo history
        if (tags.has("collaboration") || tags.has("historic")) {
          return;
        }
        if (editor.isComposing()) {
          return;
        }

        editorState.read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
            return;
          }

          const anchorKey = selection.anchor.key;
          const anchorOffset = selection.anchor.offset;
          const anchorNode = $getNodeByKey(anchorKey);

          if (!$isTextNode(anchorNode) || !dirtyLeaves.has(anchorKey)) {
            return;
          }

          // Avoid triggering formatting inside code blocks
          const parentNode = anchorNode.getParent();
          if (parentNode === null || parentNode.getType() === "code") {
            return;
          }

          const textContent = anchorNode.getTextContent();
          const match = findMathInText(textContent);

          let startIdx: number;
          let endIdx: number;
          let equation: string;
          let isInline: boolean;

          if (match) {
            // Verify that selection is within or adjacent to the math equation
            const isCursorInMatch =
              anchorOffset >= match.startIdx &&
              anchorOffset <= match.endIdx + 1;
            if (!isCursorInMatch) {
              return;
            }
            startIdx = match.startIdx;
            endIdx = match.endIdx;
            equation = match.equation;
            isInline = match.isInline;
          } else {
            // Check if the user typed "$$" for block math
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

          editor.update(() => {
            const latestAnchorNode = $getNodeByKey(anchorKey);

            if (!$isTextNode(latestAnchorNode)) {
              return;
            }

            const mathNode = $createMathNode(equation, isInline);
            const rangeSelection = $createRangeSelection();

            rangeSelection.anchor.set(
              latestAnchorNode.getKey(),
              startIdx,
              "text"
            );
            rangeSelection.focus.set(
              latestAnchorNode.getKey(),
              endIdx + 1,
              "text"
            );

            $setSelection(rangeSelection);
            $insertNodes([mathNode]);

            const nodeSelection = $createNodeSelection();
            nodeSelection.add(mathNode.getKey());
            $setSelection(nodeSelection);
          });
        });
      }
    );
  }, [editor]);

  return null;
}

/**
 * The main MDXEditor realm plugin to load the math components and behaviors.
 */
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
        </>
      ),
      [addNestedEditorChild$]: () => (
        <>
          <MathShortcutTypeListener />
        </>
      ),
      [addTableCellEditorChild$]: () => (
        <>
          <MathShortcutTypeListener />
        </>
      ),
    });
  },
});

/**
 * Toolbar button to insert inline math equation nodes.
 */
export function InsertInlineMath() {
  const insertDecoratorNode = usePublisher(insertDecoratorNode$);

  return (
    <button
      type="button"
      onClick={() => {
        insertDecoratorNode(() => $createMathNode("", true));
      }}
      className="flex min-h-7 min-w-7 items-center justify-center gap-1 rounded p-1.5 text-slate-800 transition-colors hover:bg-slate-200"
      title="Insert Inline Math (e.g. $e = mc^2$)"
    >
      <span className="font-serif text-sm font-bold">f(x)</span>
    </button>
  );
}

/**
 * Toolbar button to insert block math equation nodes.
 */
export function InsertBlockMath() {
  const insertDecoratorNode = usePublisher(insertDecoratorNode$);

  return (
    <button
      type="button"
      onClick={() => {
        insertDecoratorNode(() => $createMathNode("", false));
      }}
      className="flex min-h-7 min-w-7 items-center justify-center gap-1 rounded p-1.5 text-slate-800 transition-colors hover:bg-slate-200"
      title="Insert Block Math (e.g. $$f(x) = \\sin(x)$$)"
    >
      <span className="font-serif text-sm font-bold italic">$$</span>
    </button>
  );
}
