import { describe, expect, it } from "vitest";
import {
  filterActivity,
  getActivitySubjectOptions,
  getAvatarUrl,
  getInitials,
} from "../profile";
import type { ProfileActivityItem } from "@bluelearn/schemas";

function makeRow(
  overrides: Partial<ProfileActivityItem> = {}
): ProfileActivityItem {
  return {
    content_kind: "guide",
    is_variant: false,
    is_creation: true,
    title: "Test",
    change_summary: null,
    created_at: new Date().toISOString(),
    status: "published",
    target_slug: "test-guide",
    base_slug: "test-base",
    review_case_id: null,
    revision_id: crypto.randomUUID(),
    subjects: [],
    ...overrides,
  };
}

describe("getInitials", () => {
  it("extracts up to two initials from single-word and multi-word names", () => {
    expect(getInitials("Ada")).toBe("AD");
    expect(getInitials("Ada Lovelace")).toBe("AL");
    expect(getInitials("Alan Mathison Turing")).toBe("AM");
  });

  it("handles empty or missing input", () => {
    expect(getInitials("")).toBe("?");
    expect(getInitials(null)).toBe("?");
    expect(getInitials(undefined)).toBe("?");
  });
});

describe("getAvatarUrl", () => {
  it("returns avatar endpoint URL for an id or seed", () => {
    const base = import.meta.env.VITE_API_BASE ?? "";
    expect(getAvatarUrl("test-user-123")).toBe(`${base}/avatar/test-user-123`);
  });

  it("returns empty string when id is falsy", () => {
    expect(getAvatarUrl("")).toBe("");
    expect(getAvatarUrl(null)).toBe("");
    expect(getAvatarUrl(undefined)).toBe("");
  });
});

describe("filterActivity — subject", () => {
  const js = { slug: "javascript", name: "JavaScript" };
  const react = { slug: "react", name: "React" };

  const rowJs = makeRow({ subjects: [js] });
  const rowReact = makeRow({ subjects: [react] });
  const rowBoth = makeRow({ subjects: [js, react] });
  const rowNone = makeRow({ subjects: [] });

  it("returns all rows when no subject filter is set", () => {
    const result = filterActivity([rowJs, rowReact, rowNone], {});
    expect(result).toHaveLength(3);
  });

  it("keeps only rows that match at least one selected subject slug", () => {
    const result = filterActivity([rowJs, rowReact, rowBoth, rowNone], {
      subject: ["javascript"],
    });
    expect(result).toContain(rowJs);
    expect(result).toContain(rowBoth);
    expect(result).not.toContain(rowReact);
    expect(result).not.toContain(rowNone);
  });

  it("matches rows that have any of the selected subjects (OR semantics)", () => {
    const result = filterActivity([rowJs, rowReact, rowBoth, rowNone], {
      subject: ["javascript", "react"],
    });
    expect(result).toContain(rowJs);
    expect(result).toContain(rowReact);
    expect(result).toContain(rowBoth);
    expect(result).not.toContain(rowNone);
  });

  it("returns empty array when no rows match the selected subject", () => {
    const result = filterActivity([rowNone], { subject: ["javascript"] });
    expect(result).toHaveLength(0);
  });
});

describe("getActivitySubjectOptions", () => {
  it("derives unique sorted subject options from activity rows", () => {
    const rows = [
      makeRow({ subjects: [{ slug: "react", name: "React" }] }),
      makeRow({
        subjects: [
          { slug: "javascript", name: "JavaScript" },
          { slug: "react", name: "React" },
        ],
      }),
      makeRow({ subjects: [] }),
    ];
    const options = getActivitySubjectOptions(rows);
    expect(options).toEqual([
      { value: "javascript", label: "JavaScript" },
      { value: "react", label: "React" },
    ]);
  });

  it("returns an empty array when no rows have subjects", () => {
    const rows = [makeRow({ subjects: [] }), makeRow({ subjects: [] })];
    expect(getActivitySubjectOptions(rows)).toEqual([]);
  });
});
