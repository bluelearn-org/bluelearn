// @vitest-environment jsdom
import { render, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { BlueMarkdown } from "@/components/blue_markdown/BlueMarkdown";
import { extractHeadings } from "@/lib/guideUtils";

it("keeps formatted and duplicate headings reachable from the table of contents after a rerender", () => {
  const body =
    "## Install `curl`\n\n## Install **curl**\n\n### Read [the docs](/docs)";
  const { container, rerender } = render(<BlueMarkdown body={body} />);
  const tocIds = extractHeadings(body).map((heading) => heading.id);
  const headingIds = () =>
    within(container)
      .getAllByRole("heading")
      .map((heading) => heading.id);
  expect(headingIds()).toEqual(tocIds);
  rerender(<BlueMarkdown body={body} />);
  expect(headingIds()).toEqual(tocIds);
});
