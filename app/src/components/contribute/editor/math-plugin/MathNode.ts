import { lexical } from "@mdxeditor/editor";
import React, { Suspense } from "react";

import type {
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
} from "lexical";

const LazyMathView = React.lazy(() =>
  import("./MathView").then((module) => ({ default: module.MathView }))
);

const { DecoratorNode } = lexical;

export interface SerializedMathNode extends SerializedLexicalNode {
  equation: string;
  inline: boolean;
}

export class MathNode extends DecoratorNode<unknown> {
  __equation: string;
  __inline: boolean;

  static getType(): string {
    return "math";
  }

  static clone(node: MathNode): MathNode {
    return new MathNode(node.__equation, node.__inline, node.__key);
  }

  constructor(equation: string, inline: boolean, key?: NodeKey) {
    super(key);
    this.__equation = equation;
    this.__inline = inline;
  }

  static importJSON(serializedNode: SerializedLexicalNode): MathNode {
    const node = serializedNode as SerializedMathNode;
    return $createMathNode(node.equation, node.inline);
  }

  exportJSON(): SerializedMathNode {
    return {
      type: "math",
      version: 1,
      equation: this.__equation,
      inline: this.__inline,
    };
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const dom = document.createElement(this.__inline ? "span" : "div");
    dom.style.display = this.__inline ? "inline-block" : "block";
    dom.contentEditable = "false";
    return dom;
  }

  updateDOM(
    prevNode: MathNode,
    _dom: HTMLElement,
    _config: EditorConfig
  ): boolean {
    return prevNode.__inline !== this.__inline;
  }

  getEquation(): string {
    return this.__equation;
  }

  setEquation(equation: string): void {
    const writable = this.getWritable();
    writable.__equation = equation;
  }

  getInline(): boolean {
    return this.__inline;
  }

  setInline(inline: boolean): void {
    const writable = this.getWritable();
    writable.__inline = inline;
  }

  isInline(): boolean {
    return this.__inline;
  }

  decorate(_editor: LexicalEditor, _config: EditorConfig): React.ReactNode {
    return React.createElement(
      Suspense,
      {
        fallback: React.createElement(
          "span",
          {
            className:
              "animate-pulse text-slate-400 select-none italic text-sm",
          },
          "Loading math..."
        ),
      },
      React.createElement(LazyMathView, {
        key: this.__key,
        nodeKey: this.__key,
        equation: this.__equation,
        inline: this.__inline,
      })
    );
  }
}

export function $createMathNode(
  equation: string,
  inline: boolean,
  key?: NodeKey
): MathNode {
  return new MathNode(equation, inline, key);
}

export function $isMathNode(
  node: LexicalNode | null | undefined
): node is MathNode {
  return node instanceof MathNode;
}
