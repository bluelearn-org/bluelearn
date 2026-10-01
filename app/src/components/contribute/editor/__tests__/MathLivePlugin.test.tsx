// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SingletonMathEditor } from "../MathLivePlugin";

const editorMocks = vi.hoisted(() => {
  const state: {
    openEditor?: (payload: unknown) => boolean;
  } = {};

  return {
    state,
    editor: {
      registerCommand: vi.fn(
        (_command: unknown, listener: (payload: unknown) => boolean) => {
          state.openEditor = listener;
          return () => undefined;
        }
      ),
      update: vi.fn(),
      focus: vi.fn(),
    },
  };
});

vi.mock("mathlive", () => ({}));

vi.mock("@lexical/react/LexicalComposerContext", () => ({
  useLexicalComposerContext: () => [editorMocks.editor],
}));

const originalMathVirtualKeyboard = window.mathVirtualKeyboard;

describe("SingletonMathEditor", () => {
  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
    editorMocks.state.openEditor = undefined;
    Object.defineProperty(window, "mathVirtualKeyboard", {
      configurable: true,
      value: originalMathVirtualKeyboard,
    });
    vi.restoreAllMocks();
  });

  it("focuses the math field when its touch editor opens", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(navigator, "maxTouchPoints", {
      configurable: true,
      value: 5,
    });
    const showKeyboard = vi.fn();
    const focusMathField = vi.spyOn(HTMLElement.prototype, "focus");
    Object.assign(window, {
      mathVirtualKeyboard: {
        show: showKeyboard,
        hide: vi.fn(),
      },
    });
    const anchorElement = document.createElement("span");
    document.body.append(anchorElement);

    render(<SingletonMathEditor />);

    expect(editorMocks.state.openEditor).toBeDefined();
    act(() => {
      editorMocks.state.openEditor?.({
        latex: "",
        inline: false,
        onChange: vi.fn(),
        onRemove: vi.fn(),
        anchorElement,
        nodeKey: "math-node",
      });
    });

    expect(focusMathField).toHaveBeenCalledOnce();
    expect(focusMathField.mock.instances[0]).toBe(
      document.querySelector("math-field")
    );
    expect(showKeyboard).toHaveBeenCalledOnce();
  });
});
