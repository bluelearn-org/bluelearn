import { visit } from "unist-util-visit";
import type { ExtraProps } from "react-markdown";
import type { Plugin } from "unified";
import { getHeadingId } from "@/lib/guideUtils";

type Element = NonNullable<ExtraProps["node"]>;

function textContent(node: Element["children"][number]): string {
  if (node.type === "text") return node.value;
  if (node.type === "element") return node.children.map(textContent).join("");
  return "";
}

export const rehypeHeadingIds: Plugin = () => (tree) => {
  const seen = new Map<string, number>();
  visit(
    tree,
    (node): node is Element => node.type === "element",
    (element) => {
      if (/^h[1-6]$/.test(element.tagName)) {
        element.properties.id = getHeadingId(textContent(element), seen);
      }
    }
  );
};
