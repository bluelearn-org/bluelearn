// @vitest-environment jsdom
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createQuoteNode,
  QuoteNode,
  registerRichText,
} from "@lexical/rich-text";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  $createNodeSelection,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  KEY_ENTER_COMMAND,
} from "lexical";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import {
  MathShortcutTypeListener,
  OPEN_MATH_EDITOR_COMMAND,
  SingletonMathEditor,
} from "../MathLivePlugin";
import { $createMathNode, MathNode } from "../MathNode";
import type { LexicalEditor } from "lexical";

vi.mock("mathlive", () => ({}));

afterEach(cleanup);

function setup(inline = false) {
  let editor!: LexicalEditor;
  let math!: MathNode;
  function CaptureEditor() {
    [editor] = useLexicalComposerContext();
    useEffect(() => registerRichText(editor), []);
    return null;
  }
  render(
    <LexicalComposer
      initialConfig={{
        namespace: "math-quote-navigation-test",
        nodes: [QuoteNode, MathNode],
        onError: (error) => {
          throw error;
        },
      }}
    >
      <CaptureEditor />
      <MathShortcutTypeListener />
      <SingletonMathEditor />
    </LexicalComposer>
  );
  editor.update(
    () => {
      math = $createMathNode("\\text{Latex}", inline);
      const first = $createQuoteNode();
      const paragraph = $createParagraphNode().append(
        $createTextNode("First Block")
      );
      first.append(paragraph);
      if (inline) paragraph.append(math);
      else first.append(math);
      $getRoot()
        .clear()
        .append(
          first,
          $createQuoteNode().append(
            $createParagraphNode().append($createTextNode("Second Block"))
          )
        );
      const selection = $createNodeSelection();
      selection.add(math.getKey());
      $setSelection(selection);
    },
    { discrete: true }
  );
  return { editor, math };
}

function expectTextBetweenQuotes(editor: LexicalEditor) {
  editor.update(
    () => {
      const selection = $getSelection();
      expect($isRangeSelection(selection)).toBe(true);
      if ($isRangeSelection(selection)) selection.insertText("Between quotes");
    },
    { discrete: true }
  );
  editor.getEditorState().read(() => {
    const children = $getRoot().getChildren();
    expect(children.map((node) => node.getType())).toEqual([
      "quote",
      "paragraph",
      "quote",
    ]);
    expect(children[0].getTextContent()).toContain("First Block");
    expect(children[1].getTextContent()).toBe("Between quotes");
    expect(children[2].getTextContent()).toBe("Second Block");
  });
}

describe("text after a quoted equation", () => {
  it.each([false, true])(
    "inserts text between quotes when Enter follows selected math (inline: %s)",
    (inline) => {
      const { editor, math } = setup(inline);
      const event = new KeyboardEvent("keydown", {
        key: "Enter",
        cancelable: true,
      });
      editor.update(
        () => {
          expect(editor.dispatchCommand(KEY_ENTER_COMMAND, event)).toBe(true);
        },
        { discrete: true }
      );
      expect(event.defaultPrevented).toBe(true);
      expectTextBetweenQuotes(editor);
      editor.getEditorState().read(() => {
        expect(math.getLatest().isAttached()).toBe(true);
        expect(math.getLatest().getEquation()).toBe("\\text{Latex}");
      });
    }
  );

  it.each([false, true])(
    "handles the caret immediately after the equation (inline: %s)",
    (inline) => {
      const { editor, math } = setup(inline);
      editor.update(
        () => {
          math.selectNext();
          expect(editor.dispatchCommand(KEY_ENTER_COMMAND, null)).toBe(true);
        },
        { discrete: true }
      );
      expectTextBetweenQuotes(editor);
    }
  );

  it.each(["Enter", "Done"])(
    "returns to a text caret when %s saves the equation popup",
    (action) => {
      const { editor, math } = setup();
      const anchorElement = document.createElement("span");
      const onChange = vi.fn();
      act(() => {
        editor.dispatchCommand(OPEN_MATH_EDITOR_COMMAND, {
          latex: "\\text{Latex}",
          inline: false,
          onChange,
          onRemove: vi.fn(),
          anchorElement,
          nodeKey: math.getKey(),
        });
      });
      if (action === "Enter") {
        fireEvent.keyDown(document.querySelector("math-field")!, {
          key: "Enter",
        });
      } else {
        fireEvent.click(screen.getByRole("button", { name: "Done" }));
      }
      expect(onChange).toHaveBeenCalledWith("\\text{Latex}");
      expectTextBetweenQuotes(editor);
    }
  );

  it("reuses an empty paragraph after the quote", () => {
    const { editor } = setup();
    editor.update(
      () => {
        $getRoot().getFirstChildOrThrow().insertAfter($createParagraphNode());
        editor.dispatchCommand(KEY_ENTER_COMMAND, null);
      },
      { discrete: true }
    );
    expectTextBetweenQuotes(editor);
  });

  it.each([false, true])(
    "doesn't intercept math followed by more quoted content (inline: %s)",
    (inline) => {
      const { editor, math } = setup(inline);
      editor.update(
        () => {
          math.insertAfter(
            inline
              ? $createTextNode("Still quoted")
              : $createParagraphNode().append($createTextNode("Still quoted"))
          );
          expect(editor.dispatchCommand(KEY_ENTER_COMMAND, null)).toBe(false);
          expect($getRoot().getChildrenSize()).toBe(2);
        },
        { discrete: true }
      );
    }
  );

  it("doesn't intercept math outside a quote", () => {
    const { editor, math } = setup();
    editor.update(
      () => {
        $getRoot().append(math);
        expect(editor.dispatchCommand(KEY_ENTER_COMMAND, null)).toBe(false);
        expect($getRoot().getChildrenSize()).toBe(3);
      },
      { discrete: true }
    );
  });

  it("leaves Shift+Enter on a selected equation unchanged", () => {
    const { editor } = setup();
    editor.update(
      () => {
        const event = new KeyboardEvent("keydown", {
          key: "Enter",
          shiftKey: true,
        });
        expect(editor.dispatchCommand(KEY_ENTER_COMMAND, event)).toBe(false);
        expect($getRoot().getChildrenSize()).toBe(2);
      },
      { discrete: true }
    );
  });

  it("doesn't replace a selection spanning both quotes", () => {
    const { editor } = setup();
    editor.update(
      () => {
        const selection = $createNodeSelection();
        for (const node of $getRoot().getChildren()) {
          selection.add(node.getKey());
        }
        $setSelection(selection);
        expect(editor.dispatchCommand(KEY_ENTER_COMMAND, null)).toBe(false);
        expect($getRoot().getChildrenSize()).toBe(2);
      },
      { discrete: true }
    );
  });

  it("doesn't insert a paragraph when Escape closes the popup", () => {
    const { editor, math } = setup();
    act(() => {
      editor.dispatchCommand(OPEN_MATH_EDITOR_COMMAND, {
        latex: "\\text{Latex}",
        inline: false,
        onChange: vi.fn(),
        onRemove: vi.fn(),
        anchorElement: document.createElement("span"),
        nodeKey: math.getKey(),
      });
    });
    fireEvent.keyDown(document.querySelector("math-field")!, { key: "Escape" });
    editor.getEditorState().read(() => {
      expect($getRoot().getChildrenSize()).toBe(2);
    });
  });
});
