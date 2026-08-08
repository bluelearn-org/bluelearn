import { visit } from "unist-util-visit";

/**
 * Remark plugin that converts legacy 4-space indented code blocks into indented text paragraphs,
 * preserving modern fenced code blocks (```).
 */
export function remarkIndentedCodeAsParagraph() {
  return (tree: any) => {
    visit(tree, "code", (node: any, index: number | undefined, parent: any) => {
      // If code block has no language and no meta (i.e. created via 4-space indentation rather than ``` fenced block)
      if (!node.lang && !node.meta && parent && typeof index === "number") {
        const lines = (node.value || "").split("\n");
        const paragraphNode = {
          type: "paragraph",
          children: lines.flatMap((line: string, i: number) => {
            const nodes: Array<any> = [
              {
                type: "text",
                value: `    ${line}`,
              },
            ];
            if (i < lines.length - 1) {
              nodes.push({ type: "break" });
            }
            return nodes;
          }),
        };
        parent.children.splice(index, 1, paragraphNode);
      }
    });
  };
}

export default remarkIndentedCodeAsParagraph;
