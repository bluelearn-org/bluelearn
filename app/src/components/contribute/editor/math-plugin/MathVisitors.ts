import { $createMathNode, $isMathNode } from "./MathNode";
import type {
    LexicalExportVisitor,
    MdastImportVisitor,
} from "@mdxeditor/editor";
import type { MathNode } from "./MathNode";

export const MathImportVisitor: MdastImportVisitor<any> = {
    testNode: (node) => node.type === "math" || node.type === "inlineMath",
    visitNode: ({ mdastNode, actions }) => {
        actions.addAndStepInto(
            $createMathNode(mdastNode.value, mdastNode.type === "inlineMath")
        );
    },
};

export const MathExportVisitor: LexicalExportVisitor<MathNode, any> = {
    testLexicalNode: $isMathNode,
    visitLexicalNode: ({ lexicalNode, mdastParent, actions }) => {
        actions.appendToParent(mdastParent, {
            type: lexicalNode.getInline() ? "inlineMath" : "math",
            value: lexicalNode.getEquation(),
        } as any);
    },
};
