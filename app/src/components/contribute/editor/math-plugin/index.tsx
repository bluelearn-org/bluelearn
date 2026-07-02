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

type MathMatchResult = {
    isInline: boolean;
    startIdx: number;
    delimLength: number;
};

// --- Helper Functions ---

/**
 * Traverses the Lexical editor tree from root up to the anchor key / offset,
 * returning the traversed text segments.
 */
function getSegmentsUntilAnchor(
    root: LexicalNode,
    anchorKey: string,
    anchorOffset: number
): { segments: Array<Segment>; foundAnchor: boolean } {
    const segments: Array<Segment> = [];
    let foundAnchor = false;

    function traverse(node: LexicalNode): boolean {
        if (node.getKey() === anchorKey) {
            segments.push({
                type: "text",
                text: node.getTextContent().slice(0, anchorOffset),
                node: node as TextNode,
            });
            foundAnchor = true;
            return false;
        }

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
                if (traverse(child) === false) {
                    return false;
                }
            }
            if (
                isBlock &&
                segments.length > 0 &&
                segments[segments.length - 1].type !== "paragraph"
            ) {
                segments.push({ type: "paragraph" });
            }
        }
        return true;
    }

    traverse(root);
    return { segments, foundAnchor };
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
 * Searches backward from the end of the text to find the opening delimiter for either inline math ($)
 * or block math ($$). Returns null if no match is found.
 */
function findMathDelimiterMatch(fullText: string): MathMatchResult | null {
    if (fullText.endsWith("$$")) {
        const closeIdx = fullText.length - 2;
        if (closeIdx >= 2) {
            let idx = closeIdx - 2;
            while (idx >= 0) {
                if (fullText[idx] === "$" && fullText[idx + 1] === "$") {
                    // Check to avoid matching '$$$'
                    if (idx === 0 || fullText[idx - 1] !== "$") {
                        return {
                            isInline: false,
                            startIdx: idx,
                            delimLength: 2,
                        };
                    }
                }
                idx--;
            }
        }
    }

    // Check for Inline Math
    if (fullText.endsWith("$") && !fullText.endsWith("$$")) {
        const closeIdx = fullText.length - 1;
        if (closeIdx >= 1) {
            let idx = closeIdx - 1;
            while (idx >= 0) {
                if (fullText[idx] === "$") {
                    // Ensure the dollar sign is not adjacent to another dollar sign
                    const notAdjacentToDollar =
                        (idx === 0 || fullText[idx - 1] !== "$") &&
                        fullText[idx + 1] !== "$";
                    if (notAdjacentToDollar) {
                        return {
                            isInline: true,
                            startIdx: idx,
                            delimLength: 1,
                        };
                    }
                }
                idx--;
            }
        }
    }

    return null;
}

/**
 * Validates whether the matched inline equation string conforms to inline math syntax.
 * Rules:
 * - Cannot be empty
 * - Cannot contain newline characters
 * - Cannot start or end with a space
 */
function isValidInlineMathEquation(equation: string): boolean {
    if (equation.length === 0) return false;
    if (equation.includes("\n")) return false;
    if (equation.startsWith(" ") || equation.endsWith(" ")) return false;
    return true;
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
                    if (
                        !$isRangeSelection(selection) ||
                        !selection.isCollapsed()
                    ) {
                        return;
                    }

                    const anchorKey = selection.anchor.key;
                    const anchorOffset = selection.anchor.offset;
                    const anchorNode = $getNodeByKey(anchorKey);

                    if (
                        !$isTextNode(anchorNode) ||
                        !dirtyLeaves.has(anchorKey)
                    ) {
                        return;
                    }

                    const textContent = anchorNode.getTextContent();

                    // Only check for shortcut formatting when the user has typed '$'
                    if (
                        anchorOffset === 0 ||
                        textContent[anchorOffset - 1] !== "$"
                    ) {
                        return;
                    }

                    // Avoid triggering formatting inside code blocks
                    const parentNode = anchorNode.getParent();
                    if (
                        parentNode === null ||
                        parentNode.getType() === "code"
                    ) {
                        return;
                    }

                    const root = $getRoot();
                    const { segments, foundAnchor } = getSegmentsUntilAnchor(
                        root,
                        anchorKey,
                        anchorOffset
                    );

                    if (!foundAnchor) {
                        return;
                    }

                    const { fullText, charMap } = mapSegmentsToText(segments);
                    const match = findMathDelimiterMatch(fullText);
                    if (!match) {
                        return;
                    }

                    const { isInline, startIdx, delimLength } = match;
                    const rawEquation = fullText.slice(
                        startIdx + delimLength,
                        fullText.length - delimLength
                    );

                    // Perform inline formatting validations
                    if (isInline && !isValidInlineMathEquation(rawEquation)) {
                        return;
                    }

                    const equation = rawEquation.trim();

                    // Resolve start and end character positions to Lexical nodes
                    const startPos = charMap[startIdx];
                    const endPos = charMap[fullText.length - 1];
                    if (!startPos || !endPos) {
                        return;
                    }

                    const startNodeKey = startPos.node.getKey();
                    const startOffset = startPos.offset;
                    const endNodeKey = endPos.node.getKey();
                    const endOffset = endPos.offset;

                    // Replace range with the new MathNode
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

                        // Automatically select the inserted math node
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
            title="Insert Block Math (e.g. $$f(x) = \sin(x)$$)"
        >
            <span className="font-serif text-sm font-bold italic">$$</span>
        </button>
    );
}
