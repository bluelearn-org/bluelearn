import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { remarkIndentedCodeAsParagraph } from "../remarkIndentedCodeAsParagraph";

describe("remarkIndentedCodeAsParagraph", () => {
  it("converts 4 leading space code blocks to indented paragraphs, preserving fenced code blocks", () => {
    const processor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkIndentedCodeAsParagraph);

    const tree: any = processor.runSync(
      processor.parse(
        "    indented text line 1\n    indented text line 2\n\n```js\nconst x = 1;\n```\n\n```\nplain text code block\n```"
      )
    );

    expect(tree.children[0].type).toBe("paragraph");
    expect(tree.children[0].children[0].value).toBe("    indented text line 1");
    expect(tree.children[1].type).toBe("code");
    expect(tree.children[1].lang).toBe("js");
  });
});
