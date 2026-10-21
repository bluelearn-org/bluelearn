import { describe, expect, it } from "vitest";

import { buildBreadcrumbs } from "@/lib/breadcrumbs";

describe("buildBreadcrumbs", () => {
  it("falls back to Home / Guide when there is no origin", () => {
    expect(buildBreadcrumbs("LaTeX Usage 101")).toEqual([
      { label: "Home", path: "/" },
      { label: "LaTeX Usage 101" },
    ]);
  });

  it("includes a learning path origin", () => {
    expect(
      buildBreadcrumbs("LaTeX Usage 101", {
        type: "objective",
        title: "Technical Writing",
        path: "/objectives/technical-writing",
      })
    ).toEqual([
      { label: "Home", path: "/" },
      { label: "Technical Writing", path: "/objectives/technical-writing" },
      { label: "LaTeX Usage 101" },
    ]);
  });

  it("includes a subject origin", () => {
    expect(
      buildBreadcrumbs("LaTeX Usage 101", {
        type: "subject",
        title: "Mathematics",
        path: "/subjects/mathematics",
      })
    ).toEqual([
      { label: "Home", path: "/" },
      { label: "Mathematics", path: "/subjects/mathematics" },
      { label: "LaTeX Usage 101" },
    ]);
  });

  it("includes another guide as origin", () => {
    expect(
      buildBreadcrumbs("LaTeX Usage 101", {
        type: "guide",
        title: "Markdown Basics",
        path: "/guides/markdown-basics",
      })
    ).toEqual([
      { label: "Home", path: "/" },
      { label: "Markdown Basics", path: "/guides/markdown-basics" },
      { label: "LaTeX Usage 101" },
    ]);
  });

  it("carries where on the origin page to land", () => {
    expect(
      buildBreadcrumbs("Loops", {
        type: "objective",
        title: "Proofs",
        path: "/objectives/proofs",
        search: { view: "linear", target: "termination" },
        hash: "guide-loops",
      })[1]
    ).toEqual({
      label: "Proofs",
      path: "/objectives/proofs",
      search: { view: "linear", target: "termination" },
      hash: "guide-loops",
    });
  });

  it("keeps the current guide as the last, unlinked crumb", () => {
    const crumbs = buildBreadcrumbs("LaTeX Usage 101", {
      type: "subject",
      title: "Mathematics",
      path: "/subjects/mathematics",
    });

    expect(crumbs[crumbs.length - 1]).toEqual({ label: "LaTeX Usage 101" });
  });
});
