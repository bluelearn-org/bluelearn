// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { $createLinkNode, LinkNode } from "@lexical/link";
import {
  $createHeadingNode,
  $createQuoteNode,
  HeadingNode,
  QuoteNode,
} from "@lexical/rich-text";
import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  KEY_DOWN_COMMAND,
  createEditor,
} from "lexical";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LexicalEditor } from "lexical";
import H1RestrictionListener from "@/components/contribute/editor/H1RestrictionListener";

let editor: LexicalEditor;

vi.mock("@lexical/react/LexicalComposerContext", () => ({
  useLexicalComposerContext: () => [editor],
}));

describe("H1 restriction", () => {
  const onH1Attempted = vi.fn();

  beforeEach(() => {
    onH1Attempted.mockClear();
    editor = createEditor({
      namespace: "h1-restriction-test",
      nodes: [HeadingNode, QuoteNode, LinkNode],
      onError: (error) => {
        throw error;
      },
    });
    const root = document.createElement("div");
    document.body.append(root);
    editor.setRootElement(root);
    render(<H1RestrictionListener onH1Attempted={onH1Attempted} />);
  });

  afterEach(() => {
    cleanup();
    editor.setRootElement(null);
    document.body.replaceChildren();
  });

  function pressSpace() {
    const event = new KeyboardEvent("keydown", {
      key: " ",
      cancelable: true,
    });
    let handled = false;
    editor.update(
      () => {
        handled = editor.dispatchCommand(KEY_DOWN_COMMAND, event);
      },
      { discrete: true }
    );
    return { handled, prevented: event.defaultPrevented };
  }

  it("preserves guide text after a soft break below the hash", () => {
    editor.update(
      () => {
        const hash = $createTextNode("#");
        $getRoot().append(
          $createParagraphNode().append(
            hash,
            $createLineBreakNode(),
            $createTextNode("Existing guide text")
          ),
          $createParagraphNode().append($createTextNode("Another paragraph"))
        );
        hash.select(1, 1);
      },
      { discrete: true }
    );

    const result = pressSpace();
    editor.getEditorState().read(() => {
      const root = $getRoot();
      expect(root.getFirstChild()?.getType()).toBe("heading");
      expect(root.getFirstChild()?.getTextContent()).toBe(
        "\nExisting guide text"
      );
      expect(root.getLastChild()?.getTextContent()).toBe("Another paragraph");
      expect(root.getChildrenSize()).toBe(2);
    });
    expect(result).toEqual({ handled: true, prevented: true });
    expect(onH1Attempted).toHaveBeenCalledOnce();
  });

  it("keeps formatted text and links in separate children after the hash", () => {
    editor.update(
      () => {
        const hash = $createTextNode("#");
        $getRoot().append(
          $createParagraphNode().append(
            hash,
            $createTextNode("Bold text").toggleFormat("bold"),
            $createLinkNode("https://example.com").append(
              $createTextNode("Link")
            )
          )
        );
        hash.select(1, 1);
      },
      { discrete: true }
    );

    pressSpace();
    editor.getEditorState().read(() => {
      const heading = $getRoot().getFirstChild<HeadingNode>()!;
      expect(heading.getTag()).toBe("h2");
      expect(heading.getTextContent()).toBe("Bold textLink");
      expect(heading.getFirstChild()?.exportJSON()).toMatchObject({
        format: 1,
      });
      expect(heading.getLastChild()?.exportJSON()).toMatchObject({
        type: "link",
        url: "https://example.com",
      });
    });
  });

  it.each(["#", "#Existing heading"])(
    "converts %s to H2 and leaves the caret at the start",
    (text) => {
      editor.update(
        () => {
          const node = $createTextNode(text);
          $getRoot().append($createParagraphNode().append(node));
          node.select(1, 1);
        },
        { discrete: true }
      );

      expect(pressSpace().handled).toBe(true);
      editor.getEditorState().read(() => {
        const heading = $getRoot().getFirstChild<HeadingNode>()!;
        expect(heading.getTag()).toBe("h2");
        expect(heading.getTextContent()).toBe(text.slice(1));
        const selection = $getSelection();
        expect($isRangeSelection(selection)).toBe(true);
        if (!$isRangeSelection(selection)) throw new Error("Expected a caret");
        expect(selection.isCollapsed()).toBe(true);
        expect(selection.anchor.offset).toBe(0);
      });
      editor.update(
        () => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection))
            throw new Error("Expected a caret");
          selection.insertText("New ");
        },
        { discrete: true }
      );
      editor.getEditorState().read(() => {
        expect($getRoot().getTextContent()).toBe(`New ${text.slice(1)}`);
      });
    }
  );

  it.each(["not at the start", "selected text", "quote", "second child"])(
    "does not intercept a hash in %s",
    (scenario) => {
      editor.update(
        () => {
          const node = $createTextNode(
            scenario === "not at the start" ? "x#" : "#"
          );
          const block =
            scenario === "quote" ? $createQuoteNode() : $createParagraphNode();
          if (scenario === "second child") {
            block.append($createTextNode("prefix").toggleFormat("bold"));
          }
          block.append(node);
          $getRoot().append(block);
          node.select(
            scenario === "selected text" ? 0 : node.getTextContentSize(),
            node.getTextContentSize()
          );
        },
        { discrete: true }
      );
      const before = editor.getEditorState().toJSON();
      expect(pressSpace()).toEqual({ handled: false, prevented: false });
      expect(editor.getEditorState().toJSON()).toEqual(before);
      expect(onH1Attempted).not.toHaveBeenCalled();
    }
  );

  it("keeps the children of an inserted H1 when converting it to H2", async () => {
    editor.update(
      () => {
        $getRoot().append(
          $createHeadingNode("h1").append(
            $createTextNode("Heading"),
            $createLineBreakNode(),
            $createTextNode("More text").toggleFormat("italic")
          ),
          $createParagraphNode().append($createTextNode("Body"))
        );
      },
      { discrete: true }
    );
    await Promise.resolve();
    editor.getEditorState().read(() => {
      const heading = $getRoot().getFirstChild<HeadingNode>()!;
      expect(heading.getTag()).toBe("h2");
      expect(heading.getTextContent()).toBe("Heading\nMore text");
      expect($getRoot().getLastChild()?.getTextContent()).toBe("Body");
    });
    expect(onH1Attempted).toHaveBeenCalledOnce();
  });
});
