// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import Editor from "../Editor";

vi.mock("mathlive", () => ({}));

const IMPORTED_MARKDOWN = [
  "First paragraph of the guide, before anything else.",
  "",
  "## A Heading",
  "",
  "Second paragraph with **bold** text and _italics_.",
  "",
  "> A blockquote line that should render as a quote.",
  "",
  "| Column A | Column B |",
  "| -------- | -------- |",
  "| 1        | 2        |",
  "",
].join("\n");

/**
 * Mirrors how the Contribute flow owns `body`: GuideInfo unmounts and remounts
 * Content (and so Editor) when the user moves between the Content tab and the
 * Preview step, and Editor seeds itself from `value` on each mount.
 */
function ContributionHarness({
  onBodyChange,
}: {
  onBodyChange: (body: string) => void;
}) {
  const [body, setBody] = useState("");
  const [onContentStep, setOnContentStep] = useState(true);

  return (
    <div>
      <button
        data-testid="toggle-step"
        onClick={() => setOnContentStep((shown) => !shown)}
      >
        toggle step
      </button>

      {onContentStep && (
        <Editor
          value={body}
          onChange={(next) => {
            setBody(next);
            onBodyChange(next);
          }}
        />
      )}

      <div data-testid="preview-body">{body}</div>
    </div>
  );
}

function importFile(container: HTMLElement, contents: string) {
  const input = container.querySelector(
    'input[type="file"]'
  ) as HTMLInputElement;

  const file = new File([contents], "guide.md", { type: "text/markdown" });
  Object.defineProperty(input, "files", { value: [file] });

  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("Editor .md import", () => {
  afterEach(() => {
    cleanup();
  });

  it("propagates imported markdown to the parent without waiting for the debounce", async () => {
    const onBodyChange = vi.fn();
    const { container } = render(
      <ContributionHarness onBodyChange={onBodyChange} />
    );

    await act(async () => {
      await Promise.resolve();
    });

    importFile(container, IMPORTED_MARKDOWN);

    // FileReader resolves asynchronously; poll rather than sleeping a fixed
    // amount, so the test does not get flaky when the suite is under load.
    await waitFor(() =>
      expect(onBodyChange).toHaveBeenCalledWith(IMPORTED_MARKDOWN)
    );
  });

  it("keeps imported content through the Content -> Preview -> Content round trip", async () => {
    const onBodyChange = vi.fn();
    const { container, getByTestId } = render(
      <ContributionHarness onBodyChange={onBodyChange} />
    );

    await act(async () => {
      await Promise.resolve();
    });

    importFile(container, IMPORTED_MARKDOWN);

    await waitFor(() =>
      expect(onBodyChange).toHaveBeenCalledWith(IMPORTED_MARKDOWN)
    );

    // Navigate to Preview: Editor unmounts and the preview reads `body`.
    await act(async () => {
      getByTestId("toggle-step").click();
      await Promise.resolve();
    });

    expect(getByTestId("preview-body").textContent).toBe(IMPORTED_MARKDOWN);

    // Navigate back to Content: Editor remounts and re-seeds from `body`.
    await act(async () => {
      getByTestId("toggle-step").click();
      await Promise.resolve();
    });

    expect(getByTestId("preview-body").textContent).toBe(IMPORTED_MARKDOWN);
  });
});
