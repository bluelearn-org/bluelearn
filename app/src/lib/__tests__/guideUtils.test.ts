import { describe, expect, it } from "vitest";

import type { RevisionDraft, RevisionDraftSnapshot } from "@/lib/guideUtils";
import { isRevisionDraftUnchanged } from "@/lib/guideUtils";

const snapshot: RevisionDraftSnapshot = {
  title: "Binary Search",
  summary: "Find an element in a sorted array in O(log n).",
  body: "# Binary Search\n\nHalve the range each step.",
  change_summary: null,
  subjectIds: ["sub-1", "sub-2"],
};

const identicalDraft: RevisionDraft = {
  title: "Binary Search",
  summary: "Find an element in a sorted array in O(log n).",
  body: "# Binary Search\n\nHalve the range each step.",
  change_summary: null,
  tags: ["sub-2", "sub-1"],
  newSubjects: [],
};

describe("isRevisionDraftUnchanged", () => {
  it("returns true when the draft matches the snapshot", () => {
    expect(isRevisionDraftUnchanged(snapshot, identicalDraft)).toBe(true);
  });

  it("returns false when the title changed", () => {
    expect(
      isRevisionDraftUnchanged(snapshot, {
        ...identicalDraft,
        title: "Binary Search, Faster",
      })
    ).toBe(false);
  });

  it("returns false when the summary changed", () => {
    expect(
      isRevisionDraftUnchanged(snapshot, {
        ...identicalDraft,
        summary: "A brand new summary.",
      })
    ).toBe(false);
  });

  it("returns false when the body changed", () => {
    expect(
      isRevisionDraftUnchanged(snapshot, {
        ...identicalDraft,
        body: "# Binary Search\n\nNow with more content.",
      })
    ).toBe(false);
  });

  it("returns false when only a change summary was added", () => {
    expect(
      isRevisionDraftUnchanged(snapshot, {
        ...identicalDraft,
        change_summary: "Rewrote the intro.",
      })
    ).toBe(false);
  });

  it("returns false when a tag was added", () => {
    expect(
      isRevisionDraftUnchanged(snapshot, {
        ...identicalDraft,
        tags: ["sub-1", "sub-2", "sub-3"],
      })
    ).toBe(false);
  });

  it("returns false when a tag was removed", () => {
    expect(
      isRevisionDraftUnchanged(snapshot, {
        ...identicalDraft,
        tags: ["sub-1"],
      })
    ).toBe(false);
  });

  it("returns false when a new subject was added", () => {
    expect(
      isRevisionDraftUnchanged(snapshot, {
        ...identicalDraft,
        newSubjects: [{ name: "Rust", summary: null }],
      })
    ).toBe(false);
  });
});
