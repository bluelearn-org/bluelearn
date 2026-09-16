import { $isQuoteNode } from "@lexical/rich-text";
import {
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
} from "lexical";
import type { ElementNode, LexicalNode, TextNode } from "lexical";
import type { MathNode } from "./MathNode";

function findQuoteAncestor(node: LexicalNode): ElementNode | null {
  let current: LexicalNode | null = node;

  while (current !== null) {
    if ($isQuoteNode(current)) return current;
    current = current.getParent();
  }

  return null;
}

function findChildWithinQuote(
  node: LexicalNode,
  quote: ElementNode
): LexicalNode | null {
  let current: LexicalNode | null = node;

  while (current !== null && !current.getParent()?.is(quote)) {
    current = current.getParent();
  }

  return current;
}

function insertNextToText(
  textNode: TextNode,
  offset: number,
  mathNode: MathNode
): void {
  if (offset <= 0) {
    textNode.insertBefore(mathNode);
    return;
  }

  if (offset >= textNode.getTextContentSize()) {
    textNode.insertAfter(mathNode);
    return;
  }

  const [, trailingText] = textNode.splitText(offset);
  trailingText.insertBefore(mathNode);
}

export function $replaceTextWithBlockMathInQuote(
  textNode: TextNode,
  startOffset: number,
  endOffset: number,
  mathNode: MathNode
): boolean {
  const quote = findQuoteAncestor(textNode);
  if (quote === null) return false;

  const quoteChild = findChildWithinQuote(textNode, quote);
  if (quoteChild === null) return false;

  if (quoteChild.is(textNode)) {
    const splitNodes = textNode.splitText(startOffset, endOffset);
    const matchedNode = splitNodes[startOffset === 0 ? 0 : 1];
    matchedNode.replace(mathNode);
    return true;
  }

  textNode.spliceText(startOffset, endOffset - startOffset, "");
  quoteChild.insertAfter(mathNode);

  if ($isElementNode(quoteChild) && quoteChild.isEmpty()) {
    quoteChild.remove();
  }

  return true;
}

export function $insertBlockMathInQuote(mathNode: MathNode): boolean {
  let selection = $getSelection();
  if (!$isRangeSelection(selection)) return false;

  const anchorQuote = findQuoteAncestor(selection.anchor.getNode());
  const focusQuote = findQuoteAncestor(selection.focus.getNode());
  if (anchorQuote === null || !anchorQuote.is(focusQuote)) return false;

  if (!selection.isCollapsed()) {
    selection.removeText();
    selection = $getSelection();
    if (!$isRangeSelection(selection)) return false;
  }

  const anchorNode = selection.anchor.getNode();
  const anchorOffset = selection.anchor.offset;

  if (anchorNode.is(anchorQuote) && $isElementNode(anchorNode)) {
    anchorNode.splice(anchorOffset, 0, [mathNode]);
    return true;
  }

  const quoteChild = findChildWithinQuote(anchorNode, anchorQuote);
  if (quoteChild === null) return false;

  if (quoteChild.is(anchorNode) && $isTextNode(anchorNode)) {
    insertNextToText(anchorNode, anchorOffset, mathNode);
    return true;
  }

  quoteChild.insertAfter(mathNode);
  return true;
}
