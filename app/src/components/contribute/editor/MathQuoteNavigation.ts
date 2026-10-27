import { $isQuoteNode } from "@lexical/rich-text";
import { lexical } from "@mdxeditor/editor";
import { $isMathNode } from "./MathNode";
import type { LexicalNode } from "lexical";

const {
  $createParagraphNode,
  $getSelection,
  $isElementNode,
  $isNodeSelection,
  $isParagraphNode,
  $isRangeSelection,
} = lexical;

export function $insertParagraphAfterMathQuote(node: LexicalNode | null) {
  if (!$isMathNode(node) || node.getNextSibling()) return false;

  let quote = node.getParent();
  if ($isParagraphNode(quote)) {
    if (quote.getNextSibling()) return false;
    quote = quote.getParent();
  }
  if (!$isQuoteNode(quote)) return false;

  // A decorator at the end of a quote has no editable text after it.
  // Put the caret outside this quote without merging it with the next one.
  const next = quote.getNextSibling();
  const paragraph =
    $isParagraphNode(next) && next.isEmpty() ? next : $createParagraphNode();
  if (paragraph !== next) quote.insertAfter(paragraph);
  paragraph.select();
  return true;
}

export function $insertParagraphAfterSelectedMathQuote() {
  const selection = $getSelection();
  if ($isNodeSelection(selection)) {
    const nodes = selection.getNodes();
    return nodes.length === 1 && $insertParagraphAfterMathQuote(nodes[0]);
  }

  if (
    !$isRangeSelection(selection) ||
    !selection.isCollapsed() ||
    selection.anchor.type !== "element"
  ) {
    return false;
  }

  const parent = selection.anchor.getNode();
  if (!$isElementNode(parent)) return false;
  let previous = parent.getChildAtIndex(selection.anchor.offset - 1);
  if ($isParagraphNode(previous)) previous = previous.getLastChild();
  return $insertParagraphAfterMathQuote(previous);
}
