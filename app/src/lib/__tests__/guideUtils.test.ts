import { describe, expect, it } from "vitest";

import type { RevisionDraft, RevisionDraftSnapshot } from "@/lib/guideUtils";
import { buildGuideMeta, isRevisionDraftUnchanged } from "@/lib/guideUtils";

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

describe("buildGuideMeta", () => {
  it("formats title with '| Bluelearn'", () => {
    const meta = buildGuideMeta({
      title: "Binary Search",
    });
    expect(meta).toContainEqual({ title: "Binary Search | Bluelearn" });
    expect(meta).toContainEqual({
      property: "og:title",
      content: "Binary Search | Bluelearn",
    });
  });

  it("uses summary as description when present", () => {
    const meta = buildGuideMeta({
      title: "Binary Search",
      summary: "A search algorithm.",
      body: "A much longer body text here...",
    });
    expect(meta).toContainEqual({
      name: "description",
      content: "A search algorithm.",
    });
    expect(meta).toContainEqual({
      property: "og:description",
      content: "A search algorithm.",
    });
  });

  it("falls back to the first 150 characters of body when summary is missing", () => {
    const longBody = "A".repeat(200);
    const meta = buildGuideMeta({
      title: "Binary Search",
      summary: null,
      body: longBody,
    });
    const expectedDescription = "A".repeat(150);
    expect(meta).toContainEqual({
      name: "description",
      content: expectedDescription,
    });
    expect(meta).toContainEqual({
      property: "og:description",
      content: expectedDescription,
    });
  });

  it("formats tags as comma-separated keywords", () => {
    const meta = buildGuideMeta({
      title: "Binary Search",
      tags: [{ name: "Algorithms" }, { name: "Computer Science" }],
    });
    expect(meta).toContainEqual({
      name: "keywords",
      content: "Algorithms, Computer Science",
    });
  });

  it("omits keywords tag when no tags are provided", () => {
    const meta = buildGuideMeta({
      title: "Binary Search",
      tags: [],
    });
    expect(
      meta.find((m) => "name" in m && m.name === "keywords")
    ).toBeUndefined();
  });
});
