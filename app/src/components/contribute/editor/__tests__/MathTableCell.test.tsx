// @vitest-environment jsdom
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { cleanup, render, waitFor } from "@testing-library/react";
import {
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $isElementNode,
  $isParagraphNode,
  $setSelection,
  COMMAND_PRIORITY_EDITOR,
  createEditor,
} from "lexical";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NESTED_EDITOR_UPDATED_COMMAND } from "@mdxeditor/editor";
import type { LexicalEditor, LexicalNode } from "lexical";
import type { ReactElement } from "react";
import type { MathLiveComponentProps } from "@/components/contribute/editor/MathLivePlugin";
import { MathShortcutTypeListener } from "@/components/contribute/editor/MathLivePlugin";
import {
  $createMathNode,
  $isMathNode,
  MathNode,
} from "@/components/contribute/editor/MathNode";

vi.mock("mathlive", () => ({}));

afterEach(cleanup);

function setup(inlineOnly: boolean) {
  let editor!: LexicalEditor;
  function CaptureEditor() {
    [editor] = useLexicalComposerContext();
    return null;
  }
  render(
    <LexicalComposer
      initialConfig={{
        namespace: "TableCellEditor",
        nodes: [MathNode],
        onError: (error) => {
          throw error;
        },
      }}
    >
      <CaptureEditor />
      <MathShortcutTypeListener inlineOnly={inlineOnly} />
    </LexicalComposer>
  );
  return editor;
}

// Mirrors typing: the cell's text now reads `text` and the caret sits at `offset`.
function type(editor: LexicalEditor, text: string, offset = text.length) {
  editor.update(
    () => {
      const node = $createTextNode(text);
      $getRoot().clear().append($createParagraphNode().append(node));
      const selection = $createRangeSelection();
      selection.anchor.set(node.getKey(), offset, "text");
      selection.focus.set(node.getKey(), offset, "text");
      $setSelection(selection);
    },
    { discrete: true }
  );
}

// MDXEditor saves a table cell as `mdast.children[0].children`, so everything
// in the cell has to live inside the root's first (and only) paragraph.
function readCell(editor: LexicalEditor) {
  return editor.getEditorState().read(() => {
    const root = $getRoot();
    const paragraph = root.getFirstChild();
    if (!$isParagraphNode(paragraph)) {
      throw new Error("Expected the cell to start with a paragraph");
    }

    return {
      rootChildCount: root.getChildrenSize(),
      children: paragraph
        .getChildren()
        .map((child) =>
          $isMathNode(child)
            ? { math: child.getEquation(), inline: child.getInline() }
            : child.getTextContent()
        ),
    };
  });
}

function $findMath(node: LexicalNode): MathNode | null {
  if ($isMathNode(node)) return node;
  if (!$isElementNode(node)) return null;
  for (const child of node.getChildren()) {
    const math = $findMath(child);
    if (math) return math;
  }
  return null;
}

// The shortcut listener converts text in a follow-up update.
function waitForMath(editor: LexicalEditor) {
  return waitFor(() =>
    expect(
      editor.getEditorState().read(() => $findMath($getRoot()) !== null)
    ).toBe(true)
  );
}

describe("typed equations in table cells", () => {
  it("turns a typed block equation into an inline one", async () => {
    const editor = setup(true);
    type(editor, "ab$$x^2$$cd", 9);
    await waitForMath(editor);

    expect(readCell(editor)).toEqual({
      rootChildCount: 1,
      children: ["ab", { math: "x^2", inline: true }, "cd"],
    });
  });

  it("keeps a typed inline equation inline", async () => {
    const editor = setup(true);
    type(editor, "$x$");
    await waitForMath(editor);

    expect(readCell(editor)).toEqual({
      rootChildCount: 1,
      children: [{ math: "x", inline: true }],
    });
  });

  it("turns a bare `$$` into an empty inline equation", async () => {
    const editor = setup(true);
    type(editor, "a $$");
    await waitForMath(editor);

    expect(readCell(editor)).toEqual({
      rootChildCount: 1,
      children: ["a ", { math: "", inline: true }],
    });
  });

  it("still creates block equations outside table cells", async () => {
    const editor = setup(false);
    type(editor, "$$x^2$$");
    await waitForMath(editor);

    editor.getEditorState().read(() => {
      const math = $findMath($getRoot());
      expect(math?.getEquation()).toBe("x^2");
      expect(math?.getInline()).toBe(false);
    });
  });
});

describe("equation edits in nested editors", () => {
  it("commits the edit and asks the nested editor to save it", () => {
    const editor = createEditor({
      namespace: "TableCellEditor",
      nodes: [MathNode],
      onError: (error) => {
        throw error;
      },
    });
    let mathKey = "";

    editor.update(
      () => {
        const math = $createMathNode("x", true);
        $getRoot().append($createParagraphNode().append(math));
        mathKey = math.getKey();
      },
      { discrete: true }
    );

    // The cell editor serializes its committed state when it gets the command.
    const saved: Array<ReturnType<typeof readCell>> = [];
    editor.registerCommand(
      NESTED_EDITOR_UPDATED_COMMAND,
      () => {
        saved.push(readCell(editor));
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    );

    const element = editor.getEditorState().read(() => {
      const math = $getNodeByKey(mathKey) as MathNode;
      return math.decorate(
        editor,
        editor._config
      ) as ReactElement<MathLiveComponentProps>;
    });

    element.props.onChange("x+1");

    expect(saved).toEqual([
      { rootChildCount: 1, children: [{ math: "x+1", inline: true }] },
    ]);
  });
});
