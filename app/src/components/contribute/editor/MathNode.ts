import { NESTED_EDITOR_UPDATED_COMMAND, lexical } from "@mdxeditor/editor";
import React from "react";
import { MathLiveComponent } from "./MathLivePlugin";

import type {
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
} from "lexical";

const { DecoratorNode, $getNodeByKey } = lexical;

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

  decorate(editor: LexicalEditor, _config: EditorConfig): React.ReactNode {
    const nodeKey = this.__key;
    return React.createElement(MathLiveComponent, {
      key: nodeKey,
      nodeKey,
      latex: this.__equation,
      inline: this.__inline,
      onChange: (latex: string) => {
        editor.update(
          () => {
            const node = $getNodeByKey(nodeKey);
            if ($isMathNode(node)) {
              node.setEquation(latex);
            }
          },
          { discrete: true }
        );
        notifyNestedEditorUpdated(editor);
      },
    });
  }
}

export function notifyNestedEditorUpdated(editor: LexicalEditor): void {
  editor.dispatchCommand(NESTED_EDITOR_UPDATED_COMMAND, undefined);
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
