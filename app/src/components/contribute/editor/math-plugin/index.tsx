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
import type { LexicalNode, TextNode } from "lexical";

const {
  $createNodeSelection,
  $createRangeSelection,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isElementNode,
  $isLineBreakNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
} = lexical;

// --- Helper Types ---

type TextSegment = { type: "text"; text: string; node: TextNode };
type LinebreakSegment = { type: "linebreak" };
type ParagraphSegment = { type: "paragraph" };
type Segment = TextSegment | LinebreakSegment | ParagraphSegment;

type CharacterPosition = { node: TextNode; offset: number } | null;

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
 * Traverses the entire Lexical editor tree from root and returns all segments.
 */
function getAllSegments(root: LexicalNode): Array<Segment> {
  const segments: Array<Segment> = [];

  function traverse(node: LexicalNode): void {
    if ($isTextNode(node)) {
      segments.push({
        type: "text",
        text: node.getTextContent(),
        node,
      });
    } else if ($isLineBreakNode(node)) {
      segments.push({ type: "linebreak" });
    } else if ($isElementNode(node)) {
      const children = node.getChildren();
      const isBlock = !node.isInline();
      if (
        isBlock &&
        segments.length > 0 &&
        segments[segments.length - 1].type !== "paragraph"
      ) {
        segments.push({ type: "paragraph" });
      }
      for (const child of children) {
        traverse(child);
      }
      if (
        isBlock &&
        segments.length > 0 &&
        segments[segments.length - 1].type !== "paragraph"
      ) {
        segments.push({ type: "paragraph" });
      }
    }
  }

  traverse(root);
  return segments;
}

/**
 * Maps raw segments into a single continuous string and constructs a character map
 * that maps each character's index to its corresponding TextNode and offset.
 */
function mapSegmentsToText(segments: Array<Segment>): {
  fullText: string;
  charMap: Array<CharacterPosition>;
} {
  let fullText = "";
  const charMap: Array<CharacterPosition> = [];

  for (const segment of segments) {
    if (segment.type === "text") {
      const text = segment.text;
      const node = segment.node;
      for (let i = 0; i < text.length; i++) {
        charMap.push({ node, offset: i });
      }
      fullText += text;
    } else {
      charMap.push(null);
      fullText += "\n";
    }
  }

  return { fullText, charMap };
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

/**
 * Finds the starting index in the charMap for the given TextNode.
 */
function findNodeStartIdx(
  charMap: Array<CharacterPosition>,
  node: TextNode
): number {
  const key = node.getKey();
  for (let i = 0; i < charMap.length; i++) {
    const pos = charMap[i];
    if (pos && pos.node.getKey() === key) {
      return i;
    }
  }
  return -1;
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

          const root = $getRoot();
          const allSegments = getAllSegments(root);
          const { charMap } = mapSegmentsToText(allSegments);
          const nodeStartIdx = findNodeStartIdx(charMap, anchorNode);

          if (nodeStartIdx !== -1) {
            const startPos = charMap[nodeStartIdx + startIdx];
            const endPos = charMap[nodeStartIdx + endIdx];
            if (startPos && endPos) {
              const startNodeKey = startPos.node.getKey();
              const startOffset = startPos.offset;
              const endNodeKey = endPos.node.getKey();
              const endOffset = endPos.offset;

              editor.update(() => {
                const latestStartNode = $getNodeByKey(startNodeKey);
                const latestEndNode = $getNodeByKey(endNodeKey);

                if (
                  !$isTextNode(latestStartNode) ||
                  !$isTextNode(latestEndNode)
                ) {
                  return;
                }

                const mathNode = $createMathNode(equation, isInline);
                const rangeSelection = $createRangeSelection();
                rangeSelection.anchor.set(
                  latestStartNode.getKey(),
                  startOffset,
                  "text"
                );
                rangeSelection.focus.set(
                  latestEndNode.getKey(),
                  endOffset + 1,
                  "text"
                );
                $setSelection(rangeSelection);
                $insertNodes([mathNode]);

                const nodeSelection = $createNodeSelection();
                nodeSelection.add(mathNode.getKey());
                $setSelection(nodeSelection);
              });
            }
          }
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
