import { $createQuoteNode, $isQuoteNode, QuoteNode } from "@lexical/rich-text";
import { $createTextNode, $getRoot, $isTextNode, createEditor } from "lexical";
import { describe, expect, it } from "vitest";
import {
  $insertBlockMathInQuote,
  $replaceTextWithBlockMathInQuote,
} from "@/components/contribute/editor/MathInsertion";
import {
  $createMathNode,
  $isMathNode,
  MathNode,
} from "@/components/contribute/editor/MathNode";

function createTestEditor() {
  return createEditor({
    namespace: "math-insertion-test",
    nodes: [QuoteNode, MathNode],
    onError: (error) => {
      throw error;
    },
  });
}

describe("block math insertion in quotes", () => {
  it("replaces a typed block equation without removing its quote", () => {
    const editor = createTestEditor();

    editor.update(
      () => {
        const quote = $createQuoteNode();
        const text = $createTextNode("$$x + y$$");
        quote.append(text);
        $getRoot().append(quote);

        const math = $createMathNode("x + y", false);
        expect(
          $replaceTextWithBlockMathInQuote(
            text,
            0,
            text.getTextContentSize(),
            math
          )
        ).toBe(true);
      },
      { discrete: true }
    );

    editor.getEditorState().read(() => {
      const quote = $getRoot().getFirstChild();
      if (!$isQuoteNode(quote)) throw new Error("Expected a quote node");

      expect($isMathNode(quote.getFirstChild())).toBe(true);
      expect(quote.getFirstChild()?.getParent()).toBe(quote);
    });
  });

  it("inserts a toolbar block equation at the caret inside its quote", () => {
    const editor = createTestEditor();

    editor.update(
      () => {
        const quote = $createQuoteNode();
        const text = $createTextNode("quoted text");
        quote.append(text);
        $getRoot().append(quote);
        text.select(6, 6);

        expect($insertBlockMathInQuote($createMathNode("", false))).toBe(true);
      },
      { discrete: true }
    );

    editor.getEditorState().read(() => {
      const quote = $getRoot().getFirstChild();
      if (!$isQuoteNode(quote)) throw new Error("Expected a quote node");

      const children = quote.getChildren();
      expect(children).toHaveLength(3);
      expect($isTextNode(children[0])).toBe(true);
      expect($isMathNode(children[1])).toBe(true);
      expect($isTextNode(children[2])).toBe(true);
      expect(children[0]?.getTextContent()).toBe("quoted");
      expect(children[2]?.getTextContent()).toBe(" text");
    });
  });
});
