// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, onTestFinished } from "vitest";
import { REVIEW_QUOTE_MAX_LENGTH } from "@bluelearn/schemas";

import type { GuideBlockProps } from "@/components/GuideReader";
import { GuideMarkdown } from "@/components/GuideReader";
import {
  ANNOTATION_UI_ATTR,
  BLOCK_CONTENT_ATTR,
  BLOCK_SOURCE_END_ATTR,
  BLOCK_SOURCE_START_ATTR,
  anchorFromSelection,
  anchorHolds,
  blockAnchor,
  guideTextRanges,
  sourceRangeFits,
} from "@/lib/reviewAnchors";

const RIGID = "The cell wall is rigid.";
const BODY = [
  "Cells make **energy** with [mitochondria](https://example.org).",
  "",
  RIGID,
  "",
  RIGID,
  "",
  "![A cell diagram](https://example.org/cell.png)",
].join("\n");

const CODE = ["  const answer = 42;", "  console.log(answer);"].join("\n");
const CODE_BODY = ["Run this code:", "", "```ts", CODE, "```"].join("\n");

const LIST_BODY = [
  "Cells need:",
  "",
  "- water",
  "- energy",
  "",
  "Plants make both.",
  "",
  "> Light comes first.",
].join("\n");

// The same wrapper contract AnnotatedBlock keeps: rendered block first, then
// annotation UI that must never count as guide text.
const Block = ({ index, start, end, children }: GuideBlockProps) => (
  <div>
    <div
      {...{
        [BLOCK_CONTENT_ATTR]: index,
        [BLOCK_SOURCE_START_ATTR]: start ?? undefined,
        [BLOCK_SOURCE_END_ATTR]: end ?? undefined,
      }}
    >
      {children}
    </div>
    <div {...{ [ANNOTATION_UI_ATTR]: "" }}>
      <button type="button">Reply to block {index}</button>
    </div>
  </div>
);

function renderGuide(body = BODY) {
  const view = render(
    <div>
      <nav>Sidebar text outside the guide</nav>
      <div data-testid="root">
        <GuideMarkdown markdown={body} BlockWrapper={Block} />
      </div>
    </div>
  );
  return { ...view, root: screen.getByTestId("root") };
}

function select(start: [Node, number], end: [Node, number] = start): Selection {
  const range = document.createRange();
  range.setStart(...start);
  range.setEnd(...end);
  const selection = document.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  return selection;
}

const textIn = (element: Element, index = 0) =>
  Array.from(element.childNodes).filter(
    (node) => node.nodeType === Node.TEXT_NODE
  )[index];

const paragraphs = (root: HTMLElement) =>
  Array.from(root.querySelectorAll("p"));

const codeText = (root: HTMLElement) =>
  root.querySelector("pre code")!.firstChild!;

afterEach(() => {
  document.getSelection()?.removeAllRanges();
  cleanup();
});

describe("passage anchors", () => {
  it("anchors a selection across bold and link text to the exact characters", () => {
    const { root } = renderGuide();
    const [first] = paragraphs(root);
    const link = first.querySelector("a")!;

    const anchor = anchorFromSelection(
      select([textIn(first), "Cells ".length], [link.firstChild!, 4]),
      root
    )!;

    expect(anchor.quote).toBe("make energy with mito");
    expect([anchor.start_block, anchor.end_block]).toEqual([0, 0]);
    expect(anchor.end_offset - anchor.start_offset).toBe(anchor.quote.length);
    // The source offsets point at the markdown of the block, not the HTML.
    expect(BODY.slice(anchor.source_start!, anchor.source_end!)).toBe(
      BODY.split("\n")[0]
    );
  });

  it("spans paragraphs, but drops a block the selection only touches", () => {
    const { root } = renderGuide();
    const [, second, third] = paragraphs(root);

    const across = anchorFromSelection(
      select([textIn(second), 4], [textIn(third), 8]),
      root
    )!;
    expect([across.start_block, across.end_block]).toEqual([1, 2]);
    expect(across.quote).toBe("cell wall is rigid.\nThe cell");

    // A triple click ends at the start of the next block.
    const tripleClick = anchorFromSelection(
      select([textIn(second), 0], [third, 0]),
      root
    )!;
    expect([tripleClick.start_block, tripleClick.end_block]).toEqual([1, 1]);
    expect(tripleClick.quote).toBe(RIGID);
  });

  it("maps a repeated passage to the occurrence the reader selected", () => {
    const { root } = renderGuide();
    const [, second, third] = paragraphs(root);

    const anchor = anchorFromSelection(
      select([textIn(third), 4], [textIn(third), 13]),
      root
    )!;

    expect(anchor.quote).toBe("cell wall");
    expect(anchor.start_block).toBe(2);
    const [range] = guideTextRanges(root, anchor);
    expect(third.contains(range.startContainer)).toBe(true);
    expect(second.contains(range.startContainer)).toBe(false);
  });

  it("refuses collapsed, blank, and outside selections", () => {
    const { root } = renderGuide();
    const [first] = paragraphs(root);
    const text = textIn(first);

    expect(anchorFromSelection(select([text, 3]), root)).toBeNull();
    expect(anchorFromSelection(select([text, 5], [text, 6]), root)).toBeNull();

    const sidebar = screen.getByText("Sidebar text outside the guide");
    expect(
      anchorFromSelection(select([sidebar.firstChild!, 0], [text, 4]), root)
    ).toBeNull();

    const composer = screen.getByRole("button", { name: "Reply to block 0" });
    expect(
      anchorFromSelection(
        select([composer.firstChild!, 0], [composer.firstChild!, 5]),
        root
      )
    ).toBeNull();

    // The opposite case: real guide text in the same block qualifies.
    expect(anchorFromSelection(select([text, 0], [text, 5]), root)?.quote).toBe(
      "Cells"
    );
  });

  it("keeps an anchor only while the rendered text still reads its quote", () => {
    const { root, unmount } = renderGuide();
    const [first] = paragraphs(root);
    const anchor = anchorFromSelection(
      select([textIn(first), 0], [textIn(first), 10]),
      root
    )!;
    expect(anchorHolds(root, anchor)).toBe(true);
    unmount();

    const changed = renderGuide(BODY.replace("Cells make", "Cells take"));
    expect(anchorHolds(changed.root, anchor)).toBe(false);
  });

  it("drops an edge block that shows only list or blockquote line breaks", () => {
    const { root } = renderGuide(LIST_BODY);
    const [intro, plants, light] = paragraphs(root);
    const [water, energy] = Array.from(root.querySelectorAll("li"));
    // The list markup puts a line break before its first item.
    expect(textIn(root.querySelector("ul")!).textContent).toBe("\n");

    const intoList = anchorFromSelection(
      select([textIn(intro), 0], [textIn(water), 0]),
      root
    )!;
    expect([intoList.end_block, intoList.quote]).toEqual([0, "Cells need:"]);

    const fromList = anchorFromSelection(
      select([textIn(energy), "energy".length], [textIn(plants), 6]),
      root
    )!;
    expect([fromList.start_block, fromList.quote]).toEqual([2, "Plants"]);

    const intoQuote = anchorFromSelection(
      select([textIn(plants), 0], [textIn(light), 0]),
      root
    )!;
    expect(intoQuote.end_block).toBe(2);
    expect(intoQuote.quote).toBe("Plants make both.");
  });

  it("keeps whitespace a reader selects in code", () => {
    const { root } = renderGuide(CODE_BODY);
    const [intro] = paragraphs(root);

    const anchor = anchorFromSelection(
      select([textIn(intro), 0], [codeText(root), 2]),
      root
    )!;
    expect(anchor.end_block).toBe(1);
    expect(anchor.quote).toBe("Run this code:\n  ");
  });
});

describe("whole-block anchors", () => {
  it("anchors an image block with no text, and refuses a block that changed", () => {
    const { root } = renderGuide();
    const image = blockAnchor(root, 3)!;

    expect(image.kind).toBe("block");
    expect(image.quote).toBe("");
    expect(anchorHolds(root, image)).toBe(true);
    expect(
      anchorHolds(root, { ...image, end_offset: image.end_offset + 1 })
    ).toBe(false);
  });

  it("quotes the start of a long block and refuses a changed length", () => {
    const long = "x".repeat(REVIEW_QUOTE_MAX_LENGTH + 50);
    const { root, unmount } = renderGuide(long);
    const anchor = blockAnchor(root, 0)!;

    expect(anchor.quote).toHaveLength(REVIEW_QUOTE_MAX_LENGTH);
    expect(anchor.end_offset).toBe(long.length);
    expect(anchorHolds(root, anchor)).toBe(true);
    unmount();

    const shorter = renderGuide(long.slice(0, -1));
    expect(anchorHolds(shorter.root, anchor)).toBe(false);
  });

  it("offers source offsets only on the line edges of a block", () => {
    const { root } = renderGuide();
    const second = blockAnchor(root, 1)!;

    expect(sourceRangeFits(BODY, second.source_start, second.source_end)).toBe(
      true
    );
    expect(
      sourceRangeFits(BODY, second.source_start! + 4, second.source_end)
    ).toBe(false);
    expect(sourceRangeFits(BODY, null, null)).toBe(false);
  });
});

describe("code blocks", () => {
  it("anchors fenced code by its code text alone", () => {
    const { root } = renderGuide(CODE_BODY);
    const code = codeText(root);

    const passage = anchorFromSelection(select([code, 8], [code, 14]), root)!;
    expect(passage.quote).toBe("answer");
    expect([passage.start_block, passage.start_offset]).toEqual([1, 8]);

    const block = blockAnchor(root, 1)!;
    expect([block.quote, block.end_offset]).toEqual([CODE, CODE.length]);
    expect(guideTextRanges(root, block).map(String)).toEqual([CODE]);
    expect(
      guideTextRanges(root, { ...block, end_offset: CODE.length + 1 })
    ).toEqual([]);
    // The source offsets cover the fences, so a suggested edit replaces them.
    expect(CODE_BODY.slice(block.source_start!, block.source_end!)).toBe(
      ["```ts", CODE, "```"].join("\n")
    );
  });

  it("keeps code anchors while the Copy button reads Copied", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.resolve() },
    });
    onTestFinished(() => {
      Reflect.deleteProperty(navigator, "clipboard");
    });

    const { root } = renderGuide(CODE_BODY);
    const code = codeText(root);
    const passage = anchorFromSelection(select([code, 8], [code, 14]), root)!;
    const block = blockAnchor(root, 1)!;

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await screen.findByRole("button", { name: "Copied" });

    expect(anchorHolds(root, passage)).toBe(true);
    expect(anchorHolds(root, block)).toBe(true);
    expect(blockAnchor(root, 1)).toEqual(block);
    expect(guideTextRanges(root, passage).map(String)).toEqual(["answer"]);
  });

  it("skips the label and Copy button in a selection that spans them", () => {
    const { root } = renderGuide(CODE_BODY);
    const [intro] = paragraphs(root);
    const code = codeText(root);
    const label = screen.getByText("ts").firstChild!;
    const copy = screen.getByRole("button", { name: "Copy" }).lastChild!;

    const across = anchorFromSelection(
      select([textIn(intro), 4], [code, 7]),
      root
    )!;
    expect([across.start_block, across.end_block]).toEqual([0, 1]);
    expect(across.quote).toBe("this code:\n  const");
    expect(across.end_offset).toBe(7);
    const painted = guideTextRanges(root, across).map(String);
    expect(painted).toEqual(["this code:", "  const"]);

    // A selection edge inside the controls counts from the code text.
    const fromLabel = anchorFromSelection(select([label, 0], [code, 7]), root);
    expect(fromLabel?.quote).toBe("  const");
    const toLabel = anchorFromSelection(
      select([textIn(intro), 0], [label, 1]),
      root
    );
    expect(toLabel?.end_block).toBe(0);
    expect(anchorFromSelection(select([label, 0], [copy, 4]), root)).toBeNull();
  });
});
